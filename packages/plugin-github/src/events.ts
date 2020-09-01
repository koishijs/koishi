/* eslint-disable camelcase */
/* eslint-disable quote-props */

import { EventNames, Webhooks } from '@octokit/webhooks'
import { GetWebhookPayloadTypeFromEvent } from '@octokit/webhooks/dist-types/generated/get-webhook-payload-type-from-event'
import { Context, Session } from 'koishi-core'
import { defineProperty } from 'koishi-utils'
import { Config } from '.'
import axios from 'axios'

interface ReplyPayloads {
  link?: string
  reply?: [url: string, params?: Record<string, any>],
}

type Payload<T extends EventNames.All> = GetWebhookPayloadTypeFromEvent<T, unknown>['payload']
type EventHandler<T extends EventNames.All> = (payload: Payload<T>) => [message: string, replies?: ReplyPayloads]
type ReplyHandlers = {
  [K in keyof ReplyPayloads]: (payload: ReplyPayloads[K], session: Session, message: string) => Promise<void>
}

export default function apply(ctx: Context, config: Config) {
  const webhooks = new Webhooks({
    ...config,
    path: config.webhook,
  })

  defineProperty(ctx.app, 'githubWebhooks', webhooks)

  interface RestOptions {
    url: string
    session: Session<'githubToken'>
    message: string
    params: Record<string, any>
  }

  const request = async ({ session, url, message, params }: RestOptions) => {
    if (!session.$user.githubToken) {
      await session.$send('如果想使用此功能，请对机器人进行授权，输入你的 GitHub 用户名。')
      const name = await session.$prompt().catch<string>()
      if (!name) return
      return session.$execute({ command: 'github', args: [name] })
    }

    await axios.post(url, { ...params, body: message }, {
      httpsAgent: config.agent,
      timeout: config.requestTimeout,
      headers: {
        'User-Agent': 'koishi-plugin-github',
        'Authorization': `token ${session.$user.githubToken}`,
      },
    })
  }

  const replyHandlers: ReplyHandlers = {
    link: (url, session) => session.$send(url),
    reply: ([url, params], session, message) => request({ url, session, message, params }),
  }

  const interactions: Record<number, ReplyPayloads> = {}

  ctx.router.post(config.webhook, (ctx, next) => {
    // workaround @octokit/webhooks for koa
    ctx.req['body'] = ctx.request.body
    ctx.status = 200
    return webhooks.middleware(ctx.req, ctx.res, next)
  })

  ctx.on('before-attach-user', (session, fields) => {
    if (interactions[session.$reply]) {
      fields.add('githubToken')
    }
  })

  ctx.middleware((session, next) => {
    const body = session.$parsed
    const payloads = interactions[session.$reply]
    if (!body || !payloads) return next()

    let name: string, message: string
    if (body.startsWith('.')) {
      name = body.split(' ', 1)[0].slice(1)
      message = body.slice(2 + name.length).trim()
    } else {
      // fallback to reply
      name = 'reply'
      message = body
    }

    const payload = payloads[name]
    if (!payload) return next()
    return replyHandlers[name](payload, session, message)
  })

  function registerHandler<T extends EventNames.All>(event: T, handler: EventHandler<T>) {
    webhooks.on(event, async (callback) => {
      const { repository } = callback.payload
      const groupIds = config.repos[repository.full_name]
      if (!groupIds) return

      const result = handler(callback.payload)
      if (!result) return

      const [message, replies] = result
      const messageIds = await ctx.broadcast(groupIds, message)
      if (!replies) return

      for (const id of messageIds) {
        interactions[id] = replies
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
    const { full_name } = repository
    const { user, html_url, commit_id, body, path, position } = comment
    if (user.type === 'bot') return
    return [[
      `[GitHub] ${user.login} commented on commit ${full_name}@${commit_id.slice(0, 6)}`,
      `Path: ${path}`,
      formatMarkdown(body),
    ].join('\n'), {
      link: html_url,
      // https://docs.github.com/en/rest/reference/repos#create-a-commit-comment
      reply: [`https://api.github.com/repos/${full_name}/commits/${commit_id}/comments`, { path, position }],
    }]
  })

  registerHandler('fork', ({ repository, sender, forkee }) => {
    const { full_name, forks_count } = repository
    return [`[GitHub] ${sender.login} forked ${full_name} to ${forkee.full_name} (total ${forks_count} forks)`]
  })

  registerHandler('issues.opened', ({ repository, issue }) => {
    const { full_name } = repository
    const { user, html_url, comments_url, title, body, number } = issue
    if (user.type === 'bot') return

    return [[
      `[GitHub] ${user.login} opened an issue ${full_name}#${number}`,
      `Title: ${title}`,
      formatMarkdown(body),
    ].join('\n'), { link: html_url, reply: [comments_url] }]
  })

  registerHandler('issue_comment.created', ({ comment, issue, repository }) => {
    const { full_name } = repository
    const { number, comments_url } = issue
    const { user, html_url, body } = comment
    if (user.type === 'bot') return

    const type = issue['pull_request'] ? 'pull request' : 'issue'
    return [[
      `[GitHub] ${user.login} commented on ${type} ${full_name}#${number}`,
      formatMarkdown(body),
    ].join('\n'), { link: html_url, reply: [comments_url] }]
  })

  registerHandler('pull_request.opened', ({ repository, pull_request }) => {
    const { full_name } = repository
    const { user, html_url, comments_url, base, head, body, number } = pull_request
    if (user.type === 'bot') return

    return [[
      `[GitHub] ${user.login} opened a pull request ${full_name}#${number} (${base.label} <- ${head.label})`,
      formatMarkdown(body),
    ].join('\n'), { link: html_url, reply: [comments_url] }]
  })

  registerHandler('pull_request_review.submitted', ({ repository, review, pull_request }) => {
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

  registerHandler('pull_request_review_comment.created', ({ repository, comment, pull_request }) => {
    const { full_name } = repository
    const { number } = pull_request
    const { user, path, body, html_url, url } = comment
    if (user.type === 'bot') return
    return [[
      `[GitHub] ${user.login} commented on pull request review ${full_name}#${number}`,
      `Path: ${path}`,
      formatMarkdown(body),
    ].join('\n'), { link: html_url, reply: [url] }]
  })

  registerHandler('push', ({ compare, pusher, commits, repository, ref, after }) => {
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

  registerHandler('star.created', ({ repository, sender }) => {
    const { full_name, stargazers_count } = repository
    return [`[GitHub] ${sender.login} starred ${full_name} (total ${stargazers_count} stargazers)`]
  })
}
