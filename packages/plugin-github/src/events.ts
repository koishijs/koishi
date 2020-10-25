/* eslint-disable camelcase */

import { EventTypesPayload } from '@octokit/webhooks/dist-types/generated/get-webhook-payload-type-from-event'
import { EventData } from './server'

type WebhookEvent = Exclude<keyof EventTypesPayload, 'error'>

type SubEvent<T extends WebhookEvent> = {
  [K in WebhookEvent]: K extends '*' ? never : EventTypesPayload[K] extends EventTypesPayload[T] ? K : never
}[WebhookEvent]

interface CommentEventConfig {
  created?: boolean
  deleted?: boolean
  edited?: boolean
}

export interface EventConfig {
  commitComment?: boolean | CommentEventConfig
  create?: boolean
  delete?: boolean
  fork?: boolean
  issueComment?: boolean | CommentEventConfig
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
  pullRequestReviewComment?: boolean | CommentEventConfig
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
  star: {
    created: true,
  },
}

type Payload<T extends WebhookEvent> = EventTypesPayload[T]['payload']
type EventHandler<T extends WebhookEvent, P = {}> = (payload: Payload<T>) => EventData<P>

function formatMarkdown(source: string) {
  return source
    .replace(/^```(.*)$/gm, '')
    .replace(/^<!--(.*)-->$/gm, '')
    .replace(/\n\s*\n/g, '\n')
}

type FactoryCallback<E extends WebhookEvent, P = {}> = (event: E, payload: Payload<E>, handler: EventHandler<E, P>) => EventData<P>

type EventFactory<T extends WebhookEvent, P = {}> = <E extends T>(event: E, handler?: EventHandler<E, P>) => void

export function addListeners(on: <T extends WebhookEvent>(event: T, handler: EventHandler<T>) => void) {
  function createFactory<T extends WebhookEvent, P = {}>(callback: FactoryCallback<T, P>): EventFactory<T, P> {
    return (event, handler) => on(event, payload => callback(event, payload, handler))
  }

  type CommentEvent = 'commit_comment' | 'issue_comment' | 'pull_request_review_comment'

  interface CommentReplyPayloads {
    padding?: number[]
  }

  const onComment = createFactory<CommentEvent, CommentReplyPayloads>((event, payload, handler) => {
    const { user, body, html_url, url } = payload.comment
    if (user.type === 'Bot') return

    const [target, replies] = handler(payload)
    if (payload.action === 'deleted') {
      return [`${user.login} deleted a comment on ${target}`]
    }

    const { padding } = replies
    delete replies.padding

    const index = html_url.indexOf('#')
    const operation = payload.action === 'created' ? 'commented' : 'edited a comment'
    return [`${user.login} ${operation} on ${target}\n${formatMarkdown(body)}`, {
      link: [html_url],
      react: [url + `/reactions`],
      shot: [
        html_url.slice(0, index),
        html_url.slice(index),
        padding,
      ],
      ...replies,
    }]
  })

  onComment('commit_comment', ({ repository, comment }) => {
    const { full_name } = repository
    const { commit_id, path, position } = comment
    return [`commit ${full_name}@${commit_id.slice(0, 6)}\nPath: ${path}`, {
      // https://docs.github.com/en/rest/reference/repos#create-a-commit-comment
      reply: [`https://api.github.com/repos/${full_name}/commits/${commit_id}/comments`, { path, position }],
    }]
  })

  const onReference = createFactory<'create' | 'delete'>((event, { repository, ref, ref_type, sender }) => {
    const ref_name = `${repository.full_name}${ref_type === 'tag' ? '@' : ':'}${ref}`
    return [`${sender.login} ${event}d ${ref_type} ${ref_name}`]
  })

  onReference('create')

  onReference('delete')

  on('fork', ({ repository, sender, forkee }) => {
    const { full_name, forks_count } = repository
    return [`${sender.login} forked ${full_name} to ${forkee.full_name} (total ${forks_count} forks)`]
  })

  onComment('issue_comment', ({ issue, repository }) => {
    const { full_name } = repository
    const { number, comments_url } = issue
    const type = issue['pull_request'] ? 'pull request' : 'issue'
    return [`${type} ${full_name}#${number}`, {
      reply: [comments_url],
      padding: [16, 16, 16, 88],
    }]
  })

  const onIssue = createFactory<SubEvent<'issues'>>((event, payload, handler) => {
    const { user, url, html_url, comments_url } = payload.issue
    if (user.type === 'Bot') return

    const [message, replies] = handler(payload)
    return [message, {
      close: [url],
      link: [html_url],
      react: [url + `/reactions`],
      reply: [comments_url],
      ...replies,
    }]
  })

  onIssue('issues.opened', ({ repository, issue, sender }) => {
    const { full_name } = repository
    const { title, body, number } = issue
    return [[
      `${sender.login} opened an issue ${full_name}#${number}`,
      `Title: ${title}`,
      formatMarkdown(body),
    ].join('\n')]
  })

  onIssue('issues.closed', ({ repository, issue, sender }) => {
    const { full_name } = repository
    const { title, number } = issue
    return [`${sender.login} closed issue ${full_name}#${number}\n${title}`]
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
    if (user.type === 'Bot') return

    return [[
      `${user.login} reviewed pull request ${full_name}#${number}`,
      formatMarkdown(body),
    ].join('\n'), {
      link: [html_url],
      reply: [comments_url],
    }]
  })

  const onPullRequest = createFactory<SubEvent<'pull_request'>>((event, payload, handler) => {
    const { user, html_url, issue_url, comments_url } = payload.pull_request
    if (user.type === 'Bot') return

    const [message, replies] = handler(payload)
    return [message, {
      close: [issue_url],
      link: [html_url],
      react: [issue_url + `/reactions`],
      reply: [comments_url],
      ...replies,
    }]
  })

  onPullRequest('pull_request.closed', ({ repository, pull_request, sender }) => {
    const { full_name } = repository
    const { title, number, merged } = pull_request
    const type = merged ? 'merged' : 'closed'
    return [`${sender.login} ${type} pull request ${full_name}#${number}\n${title}`]
  })

  onPullRequest('pull_request.opened', ({ repository, pull_request, sender }) => {
    const { full_name, owner } = repository
    const { title, base, head, body, number } = pull_request

    const prefix = new RegExp(`^${owner.login}:`)
    const baseLabel = base.label.replace(prefix, '')
    const headLabel = head.label.replace(prefix, '')
    return [[
      `${sender.login} opened a pull request ${full_name}#${number} (${baseLabel} ← ${headLabel})`,
      `Title: ${title}`,
      formatMarkdown(body),
    ].join('\n')]
  })

  on('push', ({ compare, pusher, commits, repository, ref, before, after }) => {
    const { full_name } = repository

    // do not show branch create / delete
    if (/^0+$/.test(before) || /^0+$/.test(after)) return

    return [[
      `${pusher.name} pushed to ${full_name}:${ref.replace(/^refs\/heads\//, '')}`,
      ...commits.map(c => `[${c.id.slice(0, 6)}] ${formatMarkdown(c.message)}`),
    ].join('\n'), {
      link: [compare],
    }]
  })

  on('star.created', ({ repository, sender }) => {
    const { full_name, stargazers_count } = repository
    return [`${sender.login} starred ${full_name} (total ${stargazers_count} stargazers)`]
  })
}
