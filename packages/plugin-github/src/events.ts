/* eslint-disable camelcase */

import { EventNames } from '@octokit/webhooks'
import { GetWebhookPayloadTypeFromEvent } from '@octokit/webhooks/dist-types/generated/get-webhook-payload-type-from-event'

export interface EventConfig {
  commitComment?: boolean | {
    created?: boolean
  }
  fork?: boolean
  issueComment?: boolean | {
    created?: boolean
    deleted?: boolean
    edited?: boolean
  }
  issues?: boolean | {
    assigned?: boolean
    closed?: boolean
    deleted?: boolean
    demilestoned?: boolean
    edited?: boolean
    labeled?: boolean
    locked?: boolean
    milestoned?: boolean
    opened?: boolean
    pinned?: boolean
    reopened?: boolean
    transferred?: boolean
    unassigned?: boolean
    unlabeled?: boolean
    unlocked?: boolean
    unpinned?: boolean
  }
  pullRequest?: boolean | {
    assigned?: boolean
    closed?: boolean
    edited?: boolean
    labeled?: boolean
    locked?: boolean
    merged?: boolean
    opened?: boolean
    readyForReview?: boolean
    reopened?: boolean
    reviewRequestRemoved?: boolean
    reviewRequested?: boolean
    synchronize?: boolean
    unassigned?: boolean
    unlabeled?: boolean
    unlocked?: boolean
  }
  pullRequestReview?: boolean | {
    dismissed?: boolean
    edited?: boolean
    submitted?: boolean
  }
  pullRequestReviewComment?: boolean | {
    created?: boolean
    deleted?: boolean
    edited?: boolean
  }
  push?: boolean
  star?: boolean | {
    created?: boolean
    deleted?: boolean
  }
}

export const defaultEvents: EventConfig = {
  commitComment: {
    created: true,
  },
  fork: true,
  issueComment: {
    created: true,
  },
  issues: {
    closed: true,
    opened: true,
  },
  pullRequest: {
    closed: true,
    opened: true,
  },
  pullRequestReview: {
    submitted: true,
  },
  pullRequestReviewComment: {
    created: true,
  },
  push: true,
  star: {
    created: true,
  },
}

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

  type CommentEvent = 'commit_comment' | 'issue_comment' | 'pull_request_review_comment'
  type CommandHandler<E extends CommentEvent> = (payload: Payload<E>) => [target: string, replies: ReplyPayloads]

  function onComment<E extends CommentEvent>(event: E, handler: CommandHandler<E>) {
    on(event as CommentEvent, (payload) => {
      const { user, body, html_url, url } = payload.comment
      if (user.type === 'bot') return

      const [target, replies] = handler(payload)
      if (payload.action === 'deleted') {
        return [`[GitHub] ${user.login} deleted a comment on ${target}`]
      }

      const operation = payload.action === 'created' ? 'commented' : 'edited a comment'
      return [`[GitHub] ${user.login} ${operation} on ${target}\n${formatMarkdown(body)}`, {
        link: html_url,
        react: url + `/reactions`,
        ...replies,
      }]
    })
  }

  onComment('commit_comment', ({ repository, comment }) => {
    const { full_name } = repository
    const { commit_id, path, position } = comment
    return [`commit ${full_name}@${commit_id.slice(0, 6)}\nPath: ${path}`, {
      // https://docs.github.com/en/rest/reference/repos#create-a-commit-comment
      reply: [`https://api.github.com/repos/${full_name}/commits/${commit_id}/comments`, { path, position }],
    }]
  })

  on('fork', ({ repository, sender, forkee }) => {
    const { full_name, forks_count } = repository
    return [`[GitHub] ${sender.login} forked ${full_name} to ${forkee.full_name} (total ${forks_count} forks)`]
  })

  onComment('issue_comment', ({ issue, repository }) => {
    const { full_name } = repository
    const { number, comments_url } = issue
    const type = issue['pull_request'] ? 'pull request' : 'issue'
    return [`${type} ${full_name}#${number}`, {
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

  on('issues.closed', ({ repository, issue }) => {
    const { full_name } = repository
    const { user, url, html_url, comments_url, title, number } = issue
    if (user.type === 'bot') return

    return [`[GitHub] ${user.login} closed issue ${full_name}#${number}\n${title}`, {
      link: html_url,
      react: url + `/reactions`,
      reply: [comments_url],
    }]
  })

  onComment('pull_request_review_comment', ({ repository, comment, pull_request }) => {
    const { full_name } = repository
    const { number } = pull_request
    const { path, url } = comment
    return [`pull request review ${full_name}#${number}\nPath: ${path}`, {
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

  on('pull_request.closed', ({ repository, pull_request }) => {
    const { full_name } = repository
    const { user, html_url, issue_url, comments_url, title, number } = pull_request
    if (user.type === 'bot') return

    return [`[GitHub] ${user.login} closed pull request ${full_name}#${number}\n${title}`, {
      link: html_url,
      react: issue_url + '/reactions',
      reply: [comments_url],
    }]
  })

  on('pull_request.opened', ({ repository, pull_request }) => {
    const { full_name, owner } = repository
    const { user, html_url, issue_url, comments_url, title, base, head, body, number } = pull_request
    if (user.type === 'bot') return

    const prefix = new RegExp(`^${owner.login}:`)
    const baseLabel = base.label.replace(prefix, '')
    const headLabel = head.label.replace(prefix, '')
    return [[
      `[GitHub] ${user.login} opened a pull request ${full_name}#${number} (${baseLabel} <- ${headLabel})`,
      `Title: ${title}`,
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
