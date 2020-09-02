/* eslint-disable camelcase */

import { EventNames } from '@octokit/webhooks'
import { GetWebhookPayloadTypeFromEvent } from '@octokit/webhooks/dist-types/generated/get-webhook-payload-type-from-event'

export interface ReplyPayloads {
  link?: string
  react?: string
  reply?: [url: string, params?: Record<string, any>]
}

type Payload<T extends EventNames.All> = GetWebhookPayloadTypeFromEvent<T, unknown>['payload']
type EventHandler<T extends EventNames.All> = (payload: Payload<T>) => [message: string, replies?: ReplyPayloads]

export function addListeners(on: <T extends EventNames.All>(event: T, handler: EventHandler<T>) => void) {
  function formatMarkdown(source: string) {
    return source
      .replace(/^```(.*)$/gm, '')
      .replace(/\n\s*\n/g, '\n')
  }

  on('commit_comment.created', ({ repository, comment }) => {
    const { full_name } = repository
    const { user, url, html_url, commit_id, body, path, position } = comment
    if (user.type === 'bot') return
    return [[
      `[GitHub] ${user.login} commented on commit ${full_name}@${commit_id.slice(0, 6)}`,
      `Path: ${path}`,
      formatMarkdown(body),
    ].join('\n'), {
      link: html_url,
      react: url + `/reactions`,
      // https://docs.github.com/en/rest/reference/repos#create-a-commit-comment
      reply: [`https://api.github.com/repos/${full_name}/commits/${commit_id}/comments`, { path, position }],
    }]
  })

  on('fork', ({ repository, sender, forkee }) => {
    const { full_name, forks_count } = repository
    return [`[GitHub] ${sender.login} forked ${full_name} to ${forkee.full_name} (total ${forks_count} forks)`]
  })

  on('issue_comment.created', ({ comment, issue, repository }) => {
    const { full_name } = repository
    const { number, comments_url } = issue
    const { user, url, html_url, body } = comment
    if (user.type === 'bot') return

    const type = issue['pull_request'] ? 'pull request' : 'issue'
    return [[
      `[GitHub] ${user.login} commented on ${type} ${full_name}#${number}`,
      formatMarkdown(body),
    ].join('\n'), {
      link: html_url,
      react: url + `/reactions`,
      reply: [comments_url],
    }]
  })

  on('issues.opened', ({ repository, issue }) => {
    const { full_name } = repository
    const { user, url, html_url, comments_url, title, body, number } = issue
    if (user.type === 'bot') return

    return [[
      `[GitHub] ${user.login} opened an issue ${full_name}#${number}`,
      `Title: ${title}`,
      formatMarkdown(body),
    ].join('\n'), {
      link: html_url,
      react: url + `/reactions`,
      reply: [comments_url],
    }]
  })

  on('pull_request_review_comment.created', ({ repository, comment, pull_request }) => {
    const { full_name } = repository
    const { number } = pull_request
    const { user, path, body, html_url, url } = comment
    if (user.type === 'bot') return
    return [[
      `[GitHub] ${user.login} commented on pull request review ${full_name}#${number}`,
      `Path: ${path}`,
      formatMarkdown(body),
    ].join('\n'), {
      link: html_url,
      react: url + `/reactions`,
      reply: [url],
    }]
  })

  on('pull_request_review.submitted', ({ repository, review, pull_request }) => {
    if (!review.body) return
    const { full_name } = repository
    const { number, comments_url } = pull_request
    const { user, html_url, body } = review
    if (user.type === 'bot') return

    return [[
      `[GitHub] ${user.login} reviewed pull request ${full_name}#${number}`,
      formatMarkdown(body),
    ].join('\n'), { link: html_url, reply: [comments_url] }]
  })

  on('pull_request.opened', ({ repository, pull_request }) => {
    const { full_name, owner } = repository
    const { user, html_url, issue_url, comments_url, base, head, body, number } = pull_request
    if (user.type === 'bot') return

    const prefix = new RegExp(`^${owner.login}:`)
    const baseLabel = base.label.replace(prefix, '')
    const headLabel = head.label.replace(prefix, '')
    return [[
      `[GitHub] ${user.login} opened a pull request ${full_name}#${number} (${baseLabel} <- ${headLabel})`,
      formatMarkdown(body),
    ].join('\n'), {
      link: html_url,
      react: issue_url + '/reactions',
      reply: [comments_url],
    }]
  })

  on('push', ({ compare, pusher, commits, repository, ref, after }) => {
    const { full_name } = repository

    // do not show pull request merge
    if (/^0+$/.test(after)) return

    // use short form for tag releases
    if (ref.startsWith('refs/tags')) {
      return [`[GitHub] ${pusher.name} published tag ${full_name}@${ref.slice(10)}`]
    }

    return [[
      `[GitHub] ${pusher.name} pushed to ${full_name}:${ref.replace(/^refs\/heads\//, '')}`,
      ...commits.map(c => `[${c.id.slice(0, 6)}] ${formatMarkdown(c.message)}`),
    ].join('\n'), { link: compare }]
  })

  on('star.created', ({ repository, sender }) => {
    const { full_name, stargazers_count } = repository
    return [`[GitHub] ${sender.login} starred ${full_name} (total ${stargazers_count} stargazers)`]
  })
}
