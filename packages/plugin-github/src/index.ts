/* eslint-disable camelcase */

import { Context, Middleware, User } from 'koishi-core'
import { defineProperty, Logger, Time } from 'koishi-utils'
import { Octokit } from '@octokit/rest'
import { Webhooks, EventNames, EventPayloads } from '@octokit/webhooks'
import { GetWebhookPayloadTypeFromEvent } from '@octokit/webhooks/dist-types/generated/get-webhook-payload-type-from-event'
import { Agent } from 'http'
import { encode } from 'querystring'
import axios from 'axios'

type Payload<T extends EventNames.All> = GetWebhookPayloadTypeFromEvent<T, unknown>['payload']
type Repository = EventPayloads.PayloadRepository
type Issue = EventPayloads.WebhookPayloadIssuesIssue
  | EventPayloads.WebhookPayloadPullRequestPullRequest
  | EventPayloads.WebhookPayloadPullRequestReviewPullRequest
type ReviewComment = EventPayloads.WebhookPayloadPullRequestReviewCommentComment

declare module 'koishi-core/dist/app' {
  interface App {
    githubWebhooks?: Webhooks
  }
}

declare module 'koishi-core/dist/database' {
  interface User {
    githubToken?: string
  }
}

User.extend(() => ({
  githubToken: '',
}))

const logger = new Logger('github')

interface AuthorizeResult {
  access_token: string
  token_type: string
  scope: string
}

export interface Config {
  agent?: Agent
  secret?: string
  webhook?: string
  authorize?: string
  appId?: string
  appSecret?: string
  redirect?: string
  promptTimeout?: number
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
  const webhooks = new Webhooks({
    ...config,
    path: config.webhook,
  })
  defineProperty(ctx.app, 'githubWebhooks', webhooks)
  const github = new Octokit({
    request: {
      agent: config.agent,
      timeout: config.requestTimeout,
    },
  })

  const { router, database } = ctx

  router.post(config.webhook, (ctx, next) => {
    // workaround @octokit/webhooks for koa
    ctx.req['body'] = ctx.request.body
    return webhooks.middleware(ctx.req, ctx.res, next)
  })

  router.get(config.authorize, async (ctx) => {
    const targetId = parseInt(ctx.query.state)
    if (Number.isNaN(targetId)) throw new Error('Invalid targetId')
    const { code, state } = ctx.query
    const { data } = await axios.post<AuthorizeResult>('https://github.com/login/oauth/access_token', {
      client_id: config.appId,
      client_secret: config.appSecret,
      redirect_uri: config.redirect,
      code,
      state,
    }, {
      httpsAgent: config.agent,
      headers: { Accept: 'application/json' },
    })
    if (data.access_token) {
      await database.setUser(targetId, { githubToken: data.access_token })
      return ctx.status = 200
    } else {
      logger.warn(data)
      return ctx.status = 500
    }
  })

  ctx.command('github <user>', '授权 GitHub 功能')
    .action(async ({ session }, user) => {
      if (!user) return '请输入用户名。'
      const url = 'https://github.com/login/oauth/authorize?' + encode({
        client_id: config.appId,
        state: session.userId,
        redirect_uri: config.redirect,
        scope: 'admin:repo_hook,repo',
        login: user,
      })
      return '请点击下面的链接继续操作：\n' + url
    })

  const interactions: Record<number, Middleware> = {}

  ctx.middleware((session, next) => {
    const middleware = interactions[session.$reply]
    return middleware ? middleware(session, next) : next()
  })

  function registerHandler<T extends EventNames.All>(event: T, handler: (payload: Payload<T>) => [string, Middleware?]) {
    webhooks.on(event, async (callback) => {
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

  registerHandler('fork', ({ repository, sender, forkee }) => {
    return [`[GitHub] ${sender.login} forked ${repository.full_name} to ${forkee.full_name} (total ${repository.forks_count} forks)`]
  })

  const checkToken: Middleware = async (session, next) => {
    const user = await session.$observeUser(['githubToken'])
    if (!user.githubToken) {
      await session.$send('如果想使用此功能，请对机器人进行授权，输入你的 GitHub 用户名。')
      const name = await session.$prompt().catch<string>()
      if (!name) return
      return session.$execute({ command: 'github', args: [name] })
    }
    return next()
  }

  const createIssueComment = (repo: Repository, issue: Issue): Middleware => async (session, next) => {
    const body = session.$parsed
    if (!body) return next()
    return checkToken(session, async () => {
      await github.issues.createComment({
        owner: repo.owner.login,
        repo: repo.name,
        issue_number: issue.number,
        body,
        headers: {
          Authorization: `token ${session.$user['githubToken']}`,
        },
      })
    })
  }

  const createReviewCommentReply = (repo: Repository, issue: Issue, comment: ReviewComment): Middleware => async (session, next) => {
    const body = session.$parsed
    if (!body) return next()
    return checkToken(session, async () => {
      await github.pulls.createReplyForReviewComment({
        owner: repo.owner.login,
        repo: repo.name,
        pull_number: issue.number,
        comment_id: comment.id,
        body,
        headers: {
          Authorization: `token ${session.$user['githubToken']}`,
        },
      })
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
    const { user, html_url, base, head, body, number } = pull_request
    return [[
      `[GitHub] ${user.login} opened a pull request ${repository.full_name}#${number} (${base.label} <- ${head.label})`,
      `URL: ${html_url}`,
      formatMarkdown(body),
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
      `[GitHub] ${pusher.name} pushed to ${repository.full_name}:${ref.replace(/^refs\/heads\//, '')}`,
      `Compare: ${compare}`,
      ...commits.map(c => `[${c.id.slice(0, 6)}] ${formatMarkdown(c.message)}`),
    ].join('\n')]
  })

  registerHandler('star.created', ({ repository, sender }) => {
    return [`[GitHub] ${sender.login} starred ${repository.full_name} (total ${repository.stargazers_count} stargazers)`]
  })
}
