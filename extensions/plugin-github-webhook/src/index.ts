import type { Context } from 'koishi-core'
import { Webhooks } from '@octokit/webhooks'

export interface WebhookOptions {
  port?: number
  secret?: string
  path?: string
  repos?: Record<string, number[]>
}

const defaultOptions: WebhookOptions = {
  port: 12140,
  secret: '',
  path: '/webhook',
  repos: {},
}

interface RepositoryPayload {
  repository: Webhooks.PayloadRepository
}

export const name = 'github-webhook'

export function apply (ctx: Context, config: WebhookOptions = {}) {
  config = { ...defaultOptions, ...config }
  const webhook = new Webhooks(config as any)

  ctx.app.server.router.post(config.path, (ctx, next) => {
    return webhook.middleware(ctx.req, ctx.res, next)
  })

  function wrapHandler <T extends RepositoryPayload> (handler: (event: T) => void | string | Promise<void | string>) {
    return async (event: Webhooks.WebhookEvent<T>) => {
      const { repository } = event.payload
      const ids = config.repos[repository.full_name]
      if (!ids) return

      const message = await handler(event.payload)
      if (!message) return
      const groups = await ctx.database.getAllGroups(['id', 'assignee'])
      for (const { id, assignee } of groups) {
        if (ids.includes(id)) {
          await ctx.sender(assignee).sendGroupMsgAsync(id, message)
        }
      }
    }
  }

  webhook.on('commit_comment.created', wrapHandler<Webhooks.WebhookPayloadCommitComment>(({ repository, comment }) => {
    return [
      `[GitHub] Commit Comment (${repository.full_name})`,
      `User: ${comment.user.login}`,
      `URL: ${comment.html_url}`,
      comment.body.replace(/\n\s*\n/g, '\n'),
    ].join('\n')
  }))

  webhook.on('issues.opened', wrapHandler<Webhooks.WebhookPayloadIssues>(({ repository, issue }) => {
    return [
      `[GitHub] Issue Opened (${repository.full_name}#${issue.number})`,
      `Title: ${issue.title}`,
      `User: ${issue.user.login}`,
      `URL: ${issue.html_url}`,
      issue.body.replace(/\n\s*\n/g, '\n'),
    ].join('\n')
  }))

  webhook.on('issue_comment.created', wrapHandler<Webhooks.WebhookPayloadIssueComment>(({ comment, issue, repository }) => {
    return [
      `[GitHub] ${issue['pull_request'] ? 'Pull Request' : 'Issue'} Comment (${repository.full_name}#${issue.number})`,
      `User: ${comment.user.login}`,
      `URL: ${comment.html_url}`,
      comment.body.replace(/\n\s*\n/g, '\n'),
    ].join('\n')
  }))

  webhook.on('pull_request.opened', wrapHandler<Webhooks.WebhookPayloadPullRequest>(({ repository, pull_request }) => {
    return [
      `[GitHub] Pull Request Opened (${repository.full_name}#${pull_request.id})`,
      `${pull_request.base.label} <- ${pull_request.head.label}`,
      `User: ${pull_request.user.login}`,
      `URL: ${pull_request.html_url}`,
      pull_request.body.replace(/\n\s*\n/g, '\n'),
    ].join('\n')
  }))

  webhook.on('pull_request_review.submitted', wrapHandler<Webhooks.WebhookPayloadPullRequestReview>(({ repository, review, pull_request }) => {
    if (!review.body) return
    return [
      `[GitHub] Pull Request Review (${repository.full_name}#${pull_request.id})`,
      `User: ${review.user.login}`,
      `URL: ${review.html_url}`,
      // @ts-ignore
      review.body.replace(/\n\s*\n/g, '\n'),
    ].join('\n')
  }))

  webhook.on('pull_request_review_comment.created', wrapHandler<Webhooks.WebhookPayloadPullRequestReviewComment>(({ repository, comment, pull_request }) => {
    return [
      `[GitHub] Pull Request Review Comment (${repository.full_name}#${pull_request.id})`,
      `Path: ${comment.path}`,
      `User: ${comment.user.login}`,
      `URL: ${comment.html_url}`,
      comment.body.replace(/\n\s*\n/g, '\n'),
    ].join('\n')
  }))

  webhook.on('push', wrapHandler<Webhooks.WebhookPayloadPush>(({ compare, pusher, commits, repository, ref, after }) => {
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
  }))
}
