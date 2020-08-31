/* eslint-disable camelcase */

import { EventNames, EventPayloads, Webhooks } from '@octokit/webhooks'
import { GetWebhookPayloadTypeFromEvent } from '@octokit/webhooks/dist-types/generated/get-webhook-payload-type-from-event'
import { Octokit } from '@octokit/rest'
import { Context, Middleware, Session } from 'koishi-core'
import { defineProperty } from 'koishi-utils'
import { Config } from '.'

type Payload<T extends EventNames.All> = GetWebhookPayloadTypeFromEvent<T, unknown>['payload']
type Repository = EventPayloads.PayloadRepository
type Issue =
  | EventPayloads.WebhookPayloadIssuesIssue
  | EventPayloads.WebhookPayloadPullRequestPullRequest
  | EventPayloads.WebhookPayloadPullRequestReviewPullRequest
type ReviewComment = EventPayloads.WebhookPayloadPullRequestReviewCommentComment

export default function apply(ctx: Context, config: Config) {
  const github = new Octokit({
    request: {
      agent: config.agent,
      timeout: config.requestTimeout,
    },
  })

  const webhooks = new Webhooks({
    ...config,
    path: config.webhook,
  })

  defineProperty(ctx.app, 'githubWebhooks', webhooks)

  const interactions: Record<number, Middleware> = {}

  ctx.router.post(config.webhook, (ctx, next) => {
    // workaround @octokit/webhooks for koa
    ctx.req['body'] = ctx.request.body
    return webhooks.middleware(ctx.req, ctx.res, next)
  })

  ctx.on('before-attach-user', (session, fields) => {
    if (interactions[session.$reply]) {
      fields.add('githubToken')
    }
  })

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
    const { user, html_url, commit_id, body } = comment
    return [[
      `[GitHub] ${user.login} commented on commit ${repository.full_name}@${commit_id.slice(0, 6)}`,
      `URL: ${html_url}`,
      formatMarkdown(body),
    ].join('\n')]
  })

  registerHandler('fork', ({ repository, sender, forkee }) => {
    const { full_name, forks_count } = repository
    return [`[GitHub] ${sender.login} forked ${full_name} to ${forkee.full_name} (total ${forks_count} forks)`]
  })

  const checkToken: Middleware = async (session: Session<'githubToken'>, next) => {
    if (!session.$user.githubToken) {
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
    const { user, html_url, title, body, number } = issue
    return [[
      `[GitHub] ${user.login} opened an issue ${repository.full_name}#${number}`,
      `URL: ${html_url}`,
      `Title: ${title}`,
      formatMarkdown(body),
    ].join('\n'), createIssueComment(repository, issue)]
  })

  registerHandler('issue_comment.created', ({ comment, issue, repository }) => {
    const { user, html_url, body } = comment
    const type = issue['pull_request'] ? 'pull request' : 'issue'
    return [[
      `[GitHub] ${user.login} commented on ${type} ${repository.full_name}#${issue.number}`,
      `URL: ${html_url}`,
      formatMarkdown(body),
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
    const { user, html_url, body } = review
    return [[
      `[GitHub] ${user.login} reviewed pull request ${repository.full_name}#${pull_request.number}`,
      `URL: ${html_url}`,
      // @ts-ignore
      formatMarkdown(body),
    ].join('\n'), createIssueComment(repository, pull_request)]
  })

  registerHandler('pull_request_review_comment.created', ({ repository, comment, pull_request }) => {
    const { user, path, html_url, body } = comment
    return [[
      `[GitHub] ${user.login} commented on pull request review ${repository.full_name}#${pull_request.number}`,
      `Path: ${path}`,
      `URL: ${html_url}`,
      formatMarkdown(body),
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
    const { full_name, stargazers_count } = repository
    return [`[GitHub] ${sender.login} starred ${full_name} (total ${stargazers_count} stargazers)`]
  })
}
