/* eslint-disable camelcase */

import type { Context } from 'koishi-core'
import { Webhooks, EventNames } from '@octokit/webhooks'
import { Options, WebhookEvent } from '@octokit/webhooks/dist-types/types'
import { GetWebhookPayloadTypeFromEvent } from '@octokit/webhooks/dist-types/generated/get-webhook-payload-type-from-event'

export interface Config extends Options<WebhookEvent> {
  repos?: Record<string, number[]>
}

const defaultOptions: Config = {
  secret: '',
  path: '/webhook',
  repos: {},
}

export const name = 'github-webhook'

export function apply (ctx: Context, config: Config = {}) {
  config = { ...defaultOptions, ...config }
  const webhook = new Webhooks(config)

  ctx.app.server.router.post(config.path, (ctx, next) => {
    return webhook.middleware(ctx.req, ctx.res, next)
  })

  function registerHandler <T extends EventNames.All> (event: T, handler: (payload: GetWebhookPayloadTypeFromEvent<T>['payload']) => void | string | Promise<void | string>) {
    webhook.on(event, async (callback) => {
      const { repository } = callback.payload
      const ids = config.repos[repository.full_name]
      if (!ids) return

      const message = await handler(callback.payload)
      if (!message) return
      const groups = await ctx.database.getAllGroups(['id', 'assignee'])
      for (const { id, assignee } of groups) {
        if (ids.includes(id)) {
          await ctx.bots[assignee].sendGroupMsgAsync(id, message)
        }
      }
    })
  }

  registerHandler('commit_comment.created', ({ repository, comment }) => {
    return [
      `[GitHub] Commit Comment (${repository.full_name})`,
      `User: ${comment.user.login}`,
      `URL: ${comment.html_url}`,
      comment.body.replace(/\n\s*\n/g, '\n'),
    ].join('\n')
  })

  registerHandler('issues.opened', ({ repository, issue }) => {
    return [
      `[GitHub] Issue Opened (${repository.full_name}#${issue.number})`,
      `Title: ${issue.title}`,
      `User: ${issue.user.login}`,
      `URL: ${issue.html_url}`,
      issue.body.replace(/\n\s*\n/g, '\n'),
    ].join('\n')
  })

  registerHandler('issue_comment.created', ({ comment, issue, repository }) => {
    return [
      `[GitHub] ${issue['pull_request'] ? 'Pull Request' : 'Issue'} Comment (${repository.full_name}#${issue.number})`,
      `User: ${comment.user.login}`,
      `URL: ${comment.html_url}`,
      comment.body.replace(/\n\s*\n/g, '\n'),
    ].join('\n')
  })

  registerHandler('pull_request.opened', ({ repository, pull_request }) => {
    return [
      `[GitHub] Pull Request Opened (${repository.full_name}#${pull_request.id})`,
      `${pull_request.base.label} <- ${pull_request.head.label}`,
      `User: ${pull_request.user.login}`,
      `URL: ${pull_request.html_url}`,
      pull_request.body.replace(/\n\s*\n/g, '\n'),
    ].join('\n')
  })

  registerHandler('pull_request_review.submitted', ({ repository, review, pull_request }) => {
    if (!review.body) return
    return [
      `[GitHub] Pull Request Review (${repository.full_name}#${pull_request.id})`,
      `User: ${review.user.login}`,
      `URL: ${review.html_url}`,
      // @ts-ignore
      review.body.replace(/\n\s*\n/g, '\n'),
    ].join('\n')
  })

  registerHandler('pull_request_review_comment.created', ({ repository, comment, pull_request }) => {
    return [
      `[GitHub] Pull Request Review Comment (${repository.full_name}#${pull_request.id})`,
      `Path: ${comment.path}`,
      `User: ${comment.user.login}`,
      `URL: ${comment.html_url}`,
      comment.body.replace(/\n\s*\n/g, '\n'),
    ].join('\n')
  })

  registerHandler('push', ({ compare, pusher, commits, repository, ref, after }) => {
    // do not show pull request merge
    if (/^0+$/.test(after)) return

    // use short form for tag releases
    if (ref.startsWith('refs/tags')) {
      return `[GitHub] ${repository.full_name} published tag ${ref.slice(10)}`
    }

    return [
      `[GitHub] Push (${repository.full_name})`,
      `Ref: ${ref}`,
      `User: ${pusher.name}`,
      `Compare: ${compare}`,
      ...commits.map(c => c.message.replace(/\n\s*\n/g, '\n')),
    ].join('\n')
  })
}
