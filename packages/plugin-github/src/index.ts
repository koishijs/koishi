/* eslint-disable camelcase */
/* eslint-disable quote-props */

import { Context, Session } from 'koishi-core'
import { camelize, CQCode, defineProperty, Logger, Time } from 'koishi-utils'
import { encode } from 'querystring'
import { addListeners, defaultEvents, ReplyPayloads } from './events'
import { Config, GitHub } from './server'
import {} from 'koishi-plugin-puppeteer'

export * from './server'

declare module 'koishi-core/dist/app' {
  interface App {
    github?: GitHub
  }
}

type ReplyHandlers = {
  [K in keyof ReplyPayloads]: (payload: ReplyPayloads[K], session: Session, message: string) => Promise<void>
}

const defaultOptions: Config = {
  secret: '',
  prefix: '.',
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
  const { appId, prefix, redirect, webhook } = config

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

  ctx.command('github <user>', '授权 GitHub 功能')
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
    react: (url, session, content) => github.post({
      url,
      session,
      body: { content },
      headers: { accept: 'application/vnd.github.squirrel-girl-preview' },
    }),
    reply: ([url, params], session, content) => github.post({
      url,
      session,
      body: { ...params, body: formatReply(content) },
    }),
    async shot({ url, selector, padding = [] }, session) {
      const page = await app.browser.newPage()
      let buffer: Buffer
      try {
        await page.goto(url)
        const el = await page.$(selector)
        const clip = await el.boundingBox()
        const [top = 0, right = 0, bottom = 0, left = 0] = padding
        clip.x -= left
        clip.y -= top
        clip.width += left + right
        clip.height += top + bottom
        buffer = await page.screenshot({ clip })
      } catch (error) {
        new Logger('puppeteer').warn(error)
        return session.$send('截图失败。')
      } finally {
        await page.close()
      }
      return session.$send(`[CQ:image,file=base64://${buffer.toString('base64')}]`)
    },
  }

  const interactions: Record<number, ReplyPayloads> = {}

  router.post(webhook, (ctx, next) => {
    // workaround @octokit/webhooks for koa
    ctx.req['body'] = ctx.request.body
    ctx.status = 200
    return github.middleware(ctx.req, ctx.res, next)
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
    if (body.startsWith(prefix)) {
      name = body.split(' ', 1)[0].slice(prefix.length)
      message = body.slice(prefix.length + name.length).trim()
    } else {
      name = reactions.includes(body) ? 'react' : 'reply'
      message = body
    }

    const payload = payloads[name]
    if (!payload) return next()
    return replyHandlers[name](payload, session, message)
  })

  addListeners((event, handler) => {
    const base = camelize(event.split('.', 1)[0])
    github.on(event, async (callback) => {
      const { repository } = callback.payload

      // step 1: filter repository
      const groupIds = config.repos[repository.full_name]
      if (!groupIds) return

      // step 2: filter event
      const baseConfig = config.events[base] || {}
      if (baseConfig === false) return
      const action = camelize(callback.payload.action)
      if (action && baseConfig !== true) {
        const actionConfig = baseConfig[action]
        if (actionConfig === false) return
        if (actionConfig !== true && !(defaultEvents[base] || {})[action]) return
      }

      // step 3: handle event
      const result = handler(callback.payload)
      if (!result) return

      // step 4: broadcast message
      const [message, replies] = result
      const messageIds = await ctx.broadcast(groupIds, message)
      if (!replies) return

      // step 5: save message ids for interactions
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
