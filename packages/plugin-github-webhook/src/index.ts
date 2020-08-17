/* eslint-disable camelcase */

import type { Context } from 'koishi-core'
import { Webhooks, EventNames } from '@octokit/webhooks'
import { Options, WebhookEvent } from '@octokit/webhooks/dist-types/types'
import { GetWebhookPayloadTypeFromEvent } from '@octokit/webhooks/dist-types/generated/get-webhook-payload-type-from-event'

type Payload<T extends EventNames.All> = GetWebhookPayloadTypeFromEvent<T, unknown>['payload']

export interface Config extends Options<WebhookEvent> {
  repos?: Record<string, number[]>
}

const defaultOptions: Config = {
  secret: '',
  path: '/webhook',
  repos: {},
}

export const name = 'github-webhook'

export function apply(ctx: Context, config: Config = {}) {
  if (!ctx.router) throw new Error('ctx.router is not defined')

  config = { ...defaultOptions, ...config }
  const webhook = new Webhooks(config)

  ctx.app.server.router.post(config.path, (ctx, next) => {
    return webhook.middleware(ctx.req, ctx.res, next)
  })

  function registerHandler<T extends EventNames.All>(event: T, handler: (payload: Payload<T>) => string) {
    webhook.on(event, async (callback) => {
      const { repository } = callback.payload
      const ids = config.repos[repository.full_name]
      if (!ids) return

      const message = handler(callback.payload)
      await ctx.broadcast(ids, message)
    })
  }

  function formatMarkdown(source: string) {
    return source.replace(/\n\s*\n/g, '\n')
  }

  registerHandler('commit_comment.created', ({ repository, comment }) => {
    return [
      `[GitHub] ${comment.user.login} commented on commit ${repository.full_name}@${comment.commit_id.slice(0, 6)}`,
      `URL: ${comment.html_url}`,
      formatMarkdown(comment.body),
    ].join('\n')
  })

  registerHandler('issues.opened', ({ repository, issue }) => {
    return [
      `[GitHub] ${issue.user.login} opened an issue ${repository.full_name}#${issue.number}`,
      `Title: ${issue.title}`,
      `URL: ${issue.html_url}`,
      formatMarkdown(issue.body),
    ].join('\n')
  })

  registerHandler('issue_comment.created', ({ comment, issue, repository }) => {
    const type = issue['pull_request'] ? 'pull request' : 'issue'
    return [
      `[GitHub] ${comment.user.login} commented on ${type} ${repository.full_name}#${issue.number}`,
      `URL: ${comment.html_url}`,
      formatMarkdown(comment.body),
    ].join('\n')
  })

  registerHandler('pull_request.opened', ({ repository, pull_request }) => {
    return [
      `[GitHub] ${pull_request.user.login} opened a pull request ${repository.full_name}#${pull_request.number} (${pull_request.base.label} <- ${pull_request.head.label})`,
      `URL: ${pull_request.html_url}`,
      formatMarkdown(pull_request.body),
    ].join('\n')
  })

  registerHandler('pull_request_review.submitted', ({ repository, review, pull_request }) => {
    if (!review.body) return
    return [
      `[GitHub] ${review.user.login} reviewed pull request ${repository.full_name}#${pull_request.number}`,
      `URL: ${review.html_url}`,
      // @ts-ignore
      formatMarkdown(review.body),
    ].join('\n')
  })

  registerHandler('pull_request_review_comment.created', ({ repository, comment, pull_request }) => {
    return [
      `[GitHub] ${comment.user.login} commented on pull request review ${repository.full_name}#${pull_request.number}`,
      `Path: ${comment.path}`,
      `URL: ${comment.html_url}`,
      formatMarkdown(comment.body),
    ].join('\n')
  })

  registerHandler('push', ({ compare, pusher, commits, repository, ref, after }) => {
    // do not show pull request merge
    if (/^0+$/.test(after)) return

    // use short form for tag releases
    if (ref.startsWith('refs/tags')) {
      return `[GitHub] ${pusher.name} published tag ${repository.full_name}@${ref.slice(10)}`
    }

    return [
      `[GitHub] ${pusher.name} pushed to ${repository.full_name} (${ref})`,
      `Compare: ${compare}`,
      ...commits.map(c => formatMarkdown(c.message)),
    ].join('\n')
  })
}
