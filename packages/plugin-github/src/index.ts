/* eslint-disable camelcase */

import { Context, Middleware, User } from 'koishi-core'
import { Time } from 'koishi-utils'
import { Octokit } from '@octokit/rest'
import { Webhooks, EventNames, EventPayloads } from '@octokit/webhooks'
import { GetWebhookPayloadTypeFromEvent } from '@octokit/webhooks/dist-types/generated/get-webhook-payload-type-from-event'
import { Agent } from 'http'
import axios from 'axios'

type Payload<T extends EventNames.All> = GetWebhookPayloadTypeFromEvent<T, unknown>['payload']
type Repository = EventPayloads.PayloadRepository
type Issue = EventPayloads.WebhookPayloadIssuesIssue
  | EventPayloads.WebhookPayloadPullRequestPullRequest
  | EventPayloads.WebhookPayloadPullRequestReviewPullRequest
type ReviewComment = EventPayloads.WebhookPayloadPullRequestReviewCommentComment

declare module 'koishi-core/dist/database' {
  interface User {
    githubToken?: string
  }
}

User.extend(() => ({
  githubToken: '',
}))

export interface Config {
  agent?: Agent
  secret?: string
  webhook?: string
  authorize?: string
  appId?: string
  appSecret?: string
  redirectUri?: string
  replyTimeout?: number
  requestTimeout?: number
  repos?: Record<string, number[]>
}

const defaultOptions: Config = {
  secret: '',
  webhook: '/github/webhook',
  authorize: '/github/authorize',
  replyTimeout: Time.hour,
  repos: {},
}

export const name = 'github-webhook'

export function apply(ctx: Context, config: Config = {}) {
  if (!ctx.router) throw new Error('ctx.router is not defined')

  config = { ...defaultOptions, ...config }
  const webhook = new Webhooks(config)
  const github = new Octokit({
    request: {
      agent: config.agent,
      timeout: config.requestTimeout,
    },
  })

  const { router, database } = ctx

  router.post(config.webhook, (ctx, next) => {
    return webhook.middleware(ctx.req, ctx.res, next)
  })

  router.get(config.authorize, async (ctx) => {
    const targetId = parseInt(ctx.query.state)
    if (Number.isNaN(targetId)) throw new Error('Invalid targetId')
    const { code, state } = ctx.query
    const { data } = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: config.appId,
      client_secret: config.appSecret,
      redirect_uri: config.redirectUri,
      code,
      state,
    }, { httpsAgent: config.agent })
    if (data.access_token) {
      await database.setUser(targetId, { githubToken: data.access_token })
      return ctx.status = 200
    } else {
      return ctx.status = 500
    }
  })

  const interactions: Record<number, Middleware> = {}

  ctx.middleware((session, next) => {
    const middleware = interactions[session.$reply]
    return middleware ? middleware(session, next) : next()
  })

  function registerHandler<T extends EventNames.All>(event: T, handler: (payload: Payload<T>) => [string, Middleware?]) {
    webhook.on(event, async (callback) => {
      const { repository } = callback.payload
      const groupIds = config.repos[repository.full_name]
      if (!groupIds) return

      const result = handler(callback.payload)
      if (!result) return

      const [message, middleware] = result
      const messageIds = await ctx.broadcast(groupIds, message)
      if (!middleware) return

      for (const id of messageIds) {
        interactions[id] = middleware
      }
      setTimeout(() => {
        for (const id of messageIds) {
          delete interactions[id]
        }
      }, config.replyTimeout)
    })
  }

  function formatMarkdown(source: string) {
    return source
      .replace(/^```(.*)$/gm, '')
      .replace(/\n\s*\n/g, '\n')
  }

  registerHandler('commit_comment.created', ({ repository, comment }) => {
    return [[
      `[GitHub] ${comment.user.login} commented on commit ${repository.full_name}@${comment.commit_id.slice(0, 6)}`,
      `URL: ${comment.html_url}`,
      formatMarkdown(comment.body),
    ].join('\n')]
  })

  const createIssueComment = (repo: Repository, issue: Issue): Middleware => async (session, next) => {
    const body = session.$parsed
    if (!body) return next()
    const user = await session.$observeUser(['githubToken'])
    if (!user.githubToken) return // TODO hint
    await github.issues.createComment({
      owner: repo.owner.login,
      repo: repo.name,
      issue_number: issue.number,
      body,
      headers: {
        Authorization: `token ${user.githubToken}`,
      },
    })
  }

  const createReviewCommentReply = (repo: Repository, issue: Issue, comment: ReviewComment): Middleware => async (session, next) => {
    const body = session.$parsed
    if (!body) return next()
    const user = await session.$observeUser(['githubToken'])
    if (!user.githubToken) return // TODO hint
    await github.pulls.createReplyForReviewComment({
      owner: repo.owner.login,
      repo: repo.name,
      pull_number: issue.number,
      comment_id: comment.id,
      body,
      headers: {
        Authorization: `token ${user.githubToken}`,
      },
    })
  }

  registerHandler('issues.opened', ({ repository, issue }) => {
    return [[
      `[GitHub] ${issue.user.login} opened an issue ${repository.full_name}#${issue.number}`,
      `URL: ${issue.html_url}`,
      `Title: ${issue.title}`,
      formatMarkdown(issue.body),
    ].join('\n'), createIssueComment(repository, issue)]
  })

  registerHandler('issue_comment.created', ({ comment, issue, repository }) => {
    const type = issue['pull_request'] ? 'pull request' : 'issue'
    return [[
      `[GitHub] ${comment.user.login} commented on ${type} ${repository.full_name}#${issue.number}`,
      `URL: ${comment.html_url}`,
      formatMarkdown(comment.body),
    ].join('\n'), createIssueComment(repository, issue)]
  })

  registerHandler('pull_request.opened', ({ repository, pull_request }) => {
    return [[
      `[GitHub] ${pull_request.user.login} opened a pull request ${repository.full_name}#${pull_request.number} (${pull_request.base.label} <- ${pull_request.head.label})`,
      `URL: ${pull_request.html_url}`,
      formatMarkdown(pull_request.body),
    ].join('\n'), createIssueComment(repository, pull_request)]
  })

  registerHandler('pull_request_review.submitted', ({ repository, review, pull_request }) => {
    if (!review.body) return
    return [[
      `[GitHub] ${review.user.login} reviewed pull request ${repository.full_name}#${pull_request.number}`,
      `URL: ${review.html_url}`,
      // @ts-ignore
      formatMarkdown(review.body),
    ].join('\n'), createIssueComment(repository, pull_request)]
  })

  registerHandler('pull_request_review_comment.created', ({ repository, comment, pull_request }) => {
    return [[
      `[GitHub] ${comment.user.login} commented on pull request review ${repository.full_name}#${pull_request.number}`,
      `Path: ${comment.path}`,
      `URL: ${comment.html_url}`,
      formatMarkdown(comment.body),
    ].join('\n'), createReviewCommentReply(repository, pull_request, comment)]
  })

  registerHandler('push', ({ compare, pusher, commits, repository, ref, after }) => {
    // do not show pull request merge
    if (/^0+$/.test(after)) return

    // use short form for tag releases
    if (ref.startsWith('refs/tags')) {
      return [`[GitHub] ${pusher.name} published tag ${repository.full_name}@${ref.slice(10)}`]
    }

    return [[
      `[GitHub] ${pusher.name} pushed to ${repository.full_name}:${ref}`,
      `Compare: ${compare}`,
      ...commits.map(c => `[${c.id.slice(0, 6)}] ${formatMarkdown(c.message)}`),
    ].join('\n')]
  })
}
