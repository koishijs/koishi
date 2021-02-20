/* eslint-disable camelcase */
/* eslint-disable quote-props */

import { createHmac } from 'crypto'
import { Context } from 'koishi-core'
import { camelize, defineProperty, Time } from 'koishi-utils'
import { encode } from 'querystring'
import { CommonPayload, addListeners, defaultEvents } from './events'
import { Config, GitHub, ReplyHandler, EventData } from './server'

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
  const { app, database } = ctx
  const { appId, redirect, webhook } = config

  const github = new GitHub(app, config)
  defineProperty(app, 'github', github)

  app.router.get(config.authorize, async (ctx) => {
    const targetId = parseInt('' + ctx.query.state)
    if (Number.isNaN(targetId)) {
      ctx.body = 'Invalid targetId'
      return ctx.status = 400
    }
    const { code, state } = ctx.query
    const data = await github.getTokens({ code, state, redirect_uri: redirect })
    await database.setUser('id', targetId, {
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

  app.router.post(webhook, (ctx) => {
    const event = ctx.headers['x-github-event']
    const signature = ctx.headers['x-hub-signature-256']
    const id = ctx.headers['x-github-delivery']
    const payload = JSON.parse(ctx.request.body.payload)
    const fullEvent = payload.action ? `${event}/${payload.action}` : event
    app.logger('github').debug('received %s (%s)', fullEvent, id)
    if (signature !== `sha256=${createHmac('sha256', github.config.secret).update(ctx.request.rawBody).digest('hex')}`) {
      return ctx.status = 403
    }
    ctx.status = 200
    if (payload.action) {
      app.emit(`github/${fullEvent}` as any, payload)
    }
    app.emit(`github/${event}` as any, payload)
  })

  ctx.before('attach-user', (session, fields) => {
    if (!session.reply) return
    if (history[session.reply.messageId.slice(0, 6)]) {
      fields.add('ghAccessToken')
      fields.add('ghRefreshToken')
    }
  })

  ctx.middleware((session, next) => {
    if (!session.reply) return next()
    const body = session.parsed.content.trim()
    const payloads = history[session.reply.messageId.slice(0, 6)]
    if (!body || !payloads) return next()

    let name: string, message: string
    if (session.parsed.prefix !== null) {
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
    const base = camelize(event.split('/', 1)[0])
    app.on(`github/${event}` as any, async (payload: CommonPayload) => {
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
      const result = handler(payload as any)
      if (!result) return

      // step 4: broadcast message
      app.logger('github').debug('broadcast', result[0].split('\n', 1)[0])
      const messageIds = await ctx.broadcast(groupIds, config.messagePrefix + result[0])
      const hexIds = messageIds.map(id => id.slice(0, 6))

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
