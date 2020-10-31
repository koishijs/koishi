/* eslint-disable camelcase */
/* eslint-disable quote-props */

import { Context } from 'koishi-core'
import { camelize, defineProperty, Time } from 'koishi-utils'
import { encode } from 'querystring'
import { addListeners, defaultEvents } from './events'
import { Config, GitHub, ReplyHandler, EventData } from './server'
import {} from 'koishi-plugin-puppeteer'

export * from './server'

declare module 'koishi-core/dist/app' {
  interface App {
    github?: GitHub
  }
}

const defaultOptions: Config = {
  secret: '',
  messagePrefix: '[GitHub] ',
  webhook: '/github/webhook',
  authorize: '/github/authorize',
  replyTimeout: Time.hour,
  repos: {},
  events: {},
}

export const name = 'github'

export function apply(ctx: Context, config: Config = {}) {
  config = { ...defaultOptions, ...config }
  const { app, database, router } = ctx
  const { appId, redirect, webhook } = config

  const github = new GitHub(config)
  defineProperty(app, 'github', github)

  router.get(config.authorize, async (ctx) => {
    const targetId = parseInt(ctx.query.state)
    if (Number.isNaN(targetId)) {
      ctx.body = 'Invalid targetId'
      return ctx.status = 400
    }
    const { code, state } = ctx.query
    const data = await github.getTokens({ code, state, redirect_uri: redirect })
    await database.setUser(targetId, {
      ghAccessToken: data.access_token,
      ghRefreshToken: data.refresh_token,
    })
    return ctx.status = 200
  })

  ctx.command('github', 'GitHub 相关功能')

  ctx.command('github.authorize <user>', 'GitHub 授权')
    .action(async ({ session }, user) => {
      if (!user) return '请输入用户名。'
      const url = 'https://github.com/login/oauth/authorize?' + encode({
        client_id: appId,
        state: session.userId,
        redirect_uri: redirect,
        scope: 'admin:repo_hook,repo',
        login: user,
      })
      return '请点击下面的链接继续操作：\n' + url
    })

  ctx.command('github.recent', '查看最近的通知')
    .action(async () => {
      const output = Object.entries(history).slice(0, 10).map(([messageId, [message]]) => {
        const [brief] = message.split('\n', 1)
        return `${messageId}. ${brief}`
      })
      if (!output.length) return '最近没有 GitHub 通知。'
      return output.join('\n')
    })

  const reactions = ['+1', '-1', 'laugh', 'confused', 'heart', 'hooray', 'rocket', 'eyes']

  const history: Record<string, EventData> = {}

  router.post(webhook, (ctx, next) => {
    // workaround @octokit/webhooks for koa
    ctx.req['body'] = ctx.request.body
    ctx.status = 200
    return github.middleware(ctx.req, ctx.res, next)
  })

  ctx.on('before-attach-user', (session, fields) => {
    if (!session.$reply) return
    if (history[int32ToHex6(session.$reply.messageId)]) {
      fields.add('ghAccessToken')
      fields.add('ghRefreshToken')
    }
  })

  ctx.middleware((session, next) => {
    if (!session.$reply) return next()
    const body = session.$parsed.trim()
    const payloads = history[int32ToHex6(session.$reply.messageId)]
    if (!body || !payloads) return next()

    let name: string, message: string
    if (session.$prefix !== null) {
      name = body.split(' ', 1)[0]
      message = body.slice(name.length).trim()
    } else {
      name = reactions.includes(body) ? 'react' : 'reply'
      message = body
    }

    const payload = payloads[1][name]
    if (!payload) return next()
    const handler = new ReplyHandler(github, session, message)
    return handler[name](...payload)
  })

  addListeners((event, handler) => {
    const base = camelize(event.split('.', 1)[0])
    github.on(event, async ({ payload }) => {
      // step 1: filter repository
      const groupIds = config.repos[payload.repository.full_name]
      if (!groupIds) return

      // step 2: filter event
      const baseConfig = config.events[base] || {}
      if (baseConfig === false) return
      const action = camelize(payload.action)
      if (action && baseConfig !== true) {
        const actionConfig = baseConfig[action]
        if (actionConfig === false) return
        if (actionConfig !== true && !(defaultEvents[base] || {})[action]) return
      }

      // step 3: handle event
      const result = handler(payload)
      if (!result) return

      // step 4: broadcast message
      const messageIds = await ctx.broadcast(groupIds, config.messagePrefix + result[0])
      const hexIds = messageIds.map(int32ToHex6)

      // step 5: save message ids for interactions
      for (const id of hexIds) {
        history[id] = result
      }

      setTimeout(() => {
        for (const id of hexIds) {
          delete history[id]
        }
      }, config.replyTimeout)
    })
  })
}

function int32ToHex6(source: number) {
  if (source < 0) source -= 1 << 31
  return source.toString(16).padStart(8, '0').slice(2)
}
