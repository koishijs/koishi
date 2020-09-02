/* eslint-disable camelcase */
/* eslint-disable quote-props */

import { Context, Session, User } from 'koishi-core'
import { CQCode, defineProperty, Logger, Time } from 'koishi-utils'
import { Webhooks } from '@octokit/webhooks'
import { Agent } from 'https'
import { encode } from 'querystring'
import axios, { AxiosError } from 'axios'
import { addListeners, ReplyPayloads } from './events'

declare module 'koishi-core/dist/app' {
  interface App {
    githubWebhooks?: Webhooks
  }
}

declare module 'koishi-core/dist/database' {
  interface User {
    ghAccessToken?: string
    ghRefreshToken?: string
  }
}

User.extend(() => ({
  ghAccessToken: '',
  ghRefreshToken: '',
}))

export interface OAuth {
  access_token: string
  expires_in: string
  refresh_token: string
  refresh_token_expires_in: string
  token_type: string
  scope: string
}

type ReplyHandlers = {
  [K in keyof ReplyPayloads]: (payload: ReplyPayloads[K], session: Session, message: string) => Promise<void>
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

const logger = new Logger('github')

export const name = 'github'

export function apply(ctx: Context, config: Config = {}) {
  config = { ...defaultOptions, ...config }

  const webhooks = new Webhooks({
    ...config,
    path: config.webhook,
  })

  const { app, database, router } = ctx
  defineProperty(app, 'githubWebhooks', webhooks)

  async function getTokens(params: any) {
    const { data } = await axios.post<OAuth>('https://github.com/login/oauth/access_token', {
      client_id: config.appId,
      client_secret: config.appSecret,
      ...params,
    }, {
      httpsAgent: config.agent,
      headers: { Accept: 'application/json' },
    })
    return data
  }

  router.get(config.authorize, async (ctx) => {
    const targetId = parseInt(ctx.query.state)
    if (Number.isNaN(targetId)) throw new Error('Invalid targetId')
    const { code, state } = ctx.query
    const data = await getTokens({ code, state, redirect_uri: config.redirect })
    await database.setUser(targetId, {
      ghAccessToken: data.access_token,
      ghRefreshToken: data.refresh_token,
    })
    return ctx.status = 200
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

  type ReplySession = Session<'ghAccessToken' | 'ghRefreshToken'>

  async function plainRequest(url: string, session: ReplySession, params: any, accept: string) {
    logger.debug('POST', url, params)
    await axios.post(url, params, {
      httpsAgent: config.agent,
      timeout: config.requestTimeout,
      headers: {
        accept,
        authorization: `token ${session.$user.ghAccessToken}`,
      },
    })
  }

  async function authorize(session: Session, message: string) {
    await session.$send(message)
    const name = await session.$prompt(config.promptTimeout)
    if (!name) return session.$send('输入超时。')
    return session.$execute({ command: 'github', args: [name] })
  }

  async function request(url: string, session: ReplySession, params: any, accept = 'application/vnd.github.v3+json') {
    if (!session.$user.ghAccessToken) {
      return authorize(session, '如果想使用此功能，请对机器人进行授权。输入你的 GitHub 用户名。')
    }

    try {
      return await plainRequest(url, session, params, accept)
    } catch (error) {
      const { response } = error as AxiosError
      if (response?.status !== 401) {
        logger.warn(error)
        return session.$send('发送失败。')
      }
    }

    try {
      const data = await getTokens({
        refresh_token: session.$user.ghRefreshToken,
        grant_type: 'refresh_token',
      })
      session.$user.ghAccessToken = data.access_token
      session.$user.ghRefreshToken = data.refresh_token
    } catch (error) {
      return authorize(session, '令牌已失效，需要重新授权。输入你的 GitHub 用户名。')
    }

    try {
      await plainRequest(url, session, params, accept)
    } catch (error) {
      logger.warn(error)
      return session.$send('发送失败。')
    }
  }

  const reactions = ['+1', '-1', 'laugh', 'confused', 'heart', 'hooray', 'rocket', 'eyes']

  function formatReply(source: string) {
    return CQCode.parseAll(source).map((value) => {
      if (typeof value === 'string') return value
      if (value.type === 'image') return `![image](${value.data.url})`
      return ''
    }).join('')
  }

  const replyHandlers: ReplyHandlers = {
    link: (url, session) => session.$send(url),
    react: (url, session, content) => request(url, session, { content }, 'application/vnd.github.squirrel-girl-preview'),
    reply: ([url, params], session, content) => request(url, session, { ...params, body: formatReply(content) }),
  }

  const interactions: Record<number, ReplyPayloads> = {}

  router.post(config.webhook, (ctx, next) => {
    // workaround @octokit/webhooks for koa
    ctx.req['body'] = ctx.request.body
    ctx.status = 200
    return webhooks.middleware(ctx.req, ctx.res, next)
  })

  ctx.on('before-attach-user', (session, fields) => {
    if (interactions[session.$reply]) {
      fields.add('ghAccessToken')
      fields.add('ghRefreshToken')
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
      name = reactions.includes(body) ? 'react' : 'reply'
      message = body
    }

    const payload = payloads[name]
    if (!payload) return next()
    return replyHandlers[name](payload, session, message)
  })

  addListeners((event, handler) => {
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
  })
}
