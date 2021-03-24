/* eslint-disable camelcase */
/* eslint-disable quote-props */

import { createHmac } from 'crypto'
import { encode } from 'querystring'
import { Context, camelize, Time, Random, sanitize } from 'koishi-core'
import { CommonPayload, addListeners, defaultEvents } from './events'
import { Config, GitHub, ReplyHandler, ReplySession, EventData } from './server'

export * from './server'

const defaultOptions: Config = {
  secret: '',
  messagePrefix: '[GitHub] ',
  replyTimeout: Time.hour,
  repos: [],
  events: {},
}

function authorize(ctx: Context, config: Config) {
  const { appId, redirect } = config
  const { app, database } = ctx

  const tokens: Record<string, string> = {}

  ctx.router.get(config.path + '/authorize', async (ctx) => {
    const token = ctx.query.state
    if (!token || Array.isArray(token)) return ctx.status = 400
    const id = tokens[token]
    if (!id) return ctx.status = 403
    delete tokens[token]
    const { code, state } = ctx.query
    const data = await app.github.getTokens({ code, state, redirect_uri: redirect })
    await database.setUser('id', id, {
      ghAccessToken: data.access_token,
      ghRefreshToken: data.refresh_token,
    })
    return ctx.status = 200
  })

  ctx.command('github.authorize <user>', 'GitHub 授权')
    .alias('github.auth')
    .userFields(['id'])
    .action(async ({ session }, user) => {
      if (!user) return '请输入用户名。'
      const token = Random.uuid()
      tokens[token] = session.user.id
      const url = 'https://github.com/login/oauth/authorize?' + encode({
        client_id: appId,
        state: token,
        redirect_uri: redirect,
        scope: 'admin:repo_hook,repo',
        login: user,
      })
      return '请点击下面的链接继续操作：\n' + url
    })

  ctx.command('github.repos [name]', 'GitHub 仓库')
    .userFields(['ghAccessToken', 'ghRefreshToken'])
    .option('add', '-a  监听一个新的仓库')
    .option('delete', '-d  移除已监听的仓库')
    .action(async ({ session, options }, name) => {
      if (options.add || options.delete) {
        if (!name) return '请输入仓库名。'
        if (!/^[\w-]+\/[\w-]+$/.test(name)) return '请输入正确的仓库名。'
        if (!session.user.ghAccessToken) {
          return ctx.app.github.authorize(session, '要使用此功能，请对机器人进行授权。输入你的 GitHub 用户名。')
        }

        const url = `https://api.github.com/repos/${name}/hooks`
        const [repo] = await ctx.database.get('github', [name])
        if (options.add) {
          if (repo) return `已经添加过仓库 ${name}。`
          const secret = Random.uuid()
          const { id } = await ctx.app.github.request(url, 'POST', session, {
            events: ['*'],
            config: {
              secret,
              url: app.options.selfUrl + config.path + '/webhook',
            },
          })
          await ctx.database.create('github', { name, id, secret })
          return '添加仓库成功！'
        } else {
          const [repo] = await ctx.database.get('github', [name])
          if (!repo) return `尚未添加过仓库 ${name}。`
          await ctx.app.github.request(`${url}/${repo.id}`, 'DELETE', session)
          return '移除仓库成功！'
        }
      }

      const repos = await ctx.database.get('github', {})
      if (!repos.length) return '当前没有监听的仓库。'
      return repos.map(repo => repo.name).join('\n')
    })

  ctx.command('github [name]')
    .channelFields(['githubWebhooks'])
    .option('list', '-l  查看当前频道订阅的仓库列表')
    .option('add', '-a  为当前频道添加仓库订阅')
    .option('delete', '-d  从当前频道移除仓库订阅')
    .action(async ({ session, options }, name) => {
      if (options.list) {
        if (!session.channel) return '当前不是群聊上下文。'
        const names = Object.keys(session.channel.githubWebhooks)
        if (!names.length) return '当前没有订阅的仓库。'
        return names.join('\n')
      }

      if (options.add || options.delete) {
        if (!session.channel) return '当前不是群聊上下文。'
        if (!name) return '请输入仓库名。'
        if (!/^[\w-]+\/[\w-]+$/.test(name)) return '请输入正确的仓库名。'
        const [repo] = await ctx.database.get('github', [name])
        if (!repo) return `尚未添加过仓库 ${name}。`

        const webhooks = session.channel.githubWebhooks
        if (options.add) {
          if (webhooks[name]) return `已经在当前频道订阅过仓库 ${name}。`
          webhooks[name] = {}
          return '添加订阅成功！'
        } else if (options.delete) {
          if (!webhooks[name]) return `尚未在当前频道订阅过仓库 ${name}。`
          delete webhooks[name]
          return '移除订阅成功！'
        }
      }
    })
}

export const name = 'github'

export function apply(ctx: Context, config: Config = {}) {
  config = { ...defaultOptions, ...config }
  config.path = sanitize(config.path || '/github')
  const { app } = ctx

  const github = app.github = new GitHub(app, config)

  ctx.command('github', 'GitHub 相关功能').alias('gh')
    .action(({ session }) => session.execute('help github'))

  ctx.command('github.recent', '查看最近的通知')
    .action(async () => {
      const output = Object.entries(history).slice(0, 10).map(([messageId, [message]]) => {
        const [brief] = message.split('\n', 1)
        return `${messageId}. ${brief}`
      })
      if (!output.length) return '最近没有 GitHub 通知。'
      return output.join('\n')
    })

  if (ctx.database) {
    ctx.plugin(authorize, config)
  }

  const reactions = ['+1', '-1', 'laugh', 'confused', 'heart', 'hooray', 'rocket', 'eyes']

  const history: Record<string, EventData> = {}

  async function getSecret(name: string) {
    if (!ctx.database) return config.repos.find(repo => repo.name === name)?.secret
    const [data] = await ctx.database.get('github', [name])
    return data?.secret
  }

  function safeParse(source: string) {
    try {
      return JSON.parse(source)
    } catch {}
  }

  ctx.router.post(config.path + '/webhook', async (ctx) => {
    const event = ctx.headers['x-github-event']
    const signature = ctx.headers['x-hub-signature-256']
    const id = ctx.headers['x-github-delivery']
    const payload = safeParse(ctx.request.body.payload)
    if (!payload) return ctx.status = 400
    const fullEvent = payload.action ? `${event}/${payload.action}` : event
    app.logger('github').debug('received %s (%s)', fullEvent, id)
    const secret = await getSecret(payload.repository.full_name)
    // 202：服务器已接受请求，但尚未处理
    // 在 github.repos -a 时确保获得一个 2xx 的状态码
    if (!secret) return ctx.status = 202
    if (signature !== `sha256=${createHmac('sha256', secret).update(ctx.request.rawBody).digest('hex')}`) {
      return ctx.status = 403
    }
    ctx.status = 200
    if (payload.action) {
      app.emit(`github/${fullEvent}` as any, payload)
    }
    app.emit(`github/${event}` as any, payload)
  })

  ctx.before('attach-user', (session, fields) => {
    if (!session.quote) return
    if (history[session.quote.messageId.slice(0, 6)]) {
      fields.add('ghAccessToken')
      fields.add('ghRefreshToken')
    }
  })

  ctx.middleware((session: ReplySession, next) => {
    if (!session.quote) return next()
    const body = session.parsed.content.trim()
    const payloads = history[session.quote.messageId.slice(0, 6)]
    if (!body || !payloads) return next()

    let name: string, message: string
    if (session.parsed.prefix !== null || session.parsed.appel) {
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
