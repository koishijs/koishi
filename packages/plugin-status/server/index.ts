import { Context, App, Argv } from 'koishi-core'
import { interpolate, Random, Time } from 'koishi-utils'
import { ActiveData } from './database'
import * as WebUI from './webui'
import Profile from './profile'
import Statistics from './stats'

export * from './database'

declare module 'koishi-core' {
  interface Bot {
    messageSent: number[]
    messageReceived: number[]
  }

  interface EventMap {
    'status/tick'(): void
  }

  interface User {
    token: string
    expire: number
  }
}

export interface Config extends WebUI.Config {
  refresh?: number
  format?: string
  formatBot?: string
}

export interface Status extends Profile, ActiveData {
  timestamp: number
  startTime: number
}

type StatusCallback = (this: App, status: Status, config: Config) => void | Promise<void>
const callbacks: StatusCallback[] = []

export function extend(callback: StatusCallback) {
  callbacks.push(callback)
}

extend(async function (status) {
  if (!this.database) return
  Object.assign(status, await this.database.getActiveData())
})

const defaultConfig: Config = {
  refresh: Time.minute,
  // eslint-disable-next-line no-template-curly-in-string
  formatBot: '{{ username }}：{{ code ? `无法连接` : `工作中（${currentRate[0]}/min）` }}',
  format: [
    '{{ bots }}',
    '==========',
    '活跃用户数量：{{ activeUsers }}',
    '活跃群数量：{{ activeGroups }}',
    'CPU 使用率：{{ (cpu[0] * 100).toFixed() }}% / {{ (cpu[1] * 100).toFixed() }}%',
    '内存使用率：{{ (memory[0] * 100).toFixed() }}% / {{ (memory[1] * 100).toFixed() }}%',
  ].join('\n'),
}

const states: Record<number, [string, number, boolean?]> = {}

const TOKEN_SHORTTERM = 10 * 60 * 1000
const TOKEN_LONGTERM = 7 * 24 * 60 * 60 * 1000

export const name = 'status'

export function apply(ctx: Context, config: Config = {}) {
  const { refresh, formatBot, format } = { ...defaultConfig, ...config }

  ctx.all().on('command', ({ session }: Argv<'lastCall'>) => {
    session.user.lastCall = new Date()
  })

  ctx.router.get('/status', async (koa) => {
    koa.set('Access-Control-Allow-Origin', '*')
    koa.body = await getStatus()
  })

  ctx.router.get('/status/validate', async (koa) => {
    const { platform, userId } = koa.query
    koa.set('Access-Control-Allow-Origin', '*')
    if (!platform || !userId) return koa.status = 403
    const id = `${platform}:${userId}`
    if (!states[id]) {
      const token = Random.uuid()
      const expire = Date.now() + TOKEN_SHORTTERM
      states[id] = [token, expire]
      setTimeout(() => {
        if (states[id]?.[1] > Date.now()) delete states[token]
      }, TOKEN_SHORTTERM)
      return koa.body = { token, expire }
    }
    const [token, expire, valid] = states[id]
    if (valid) {
      const user = await ctx.database.getUser(platform, userId)
      koa.body = { token, expire, user }
      delete states[id]
    } else {
      koa.body = { token, expire }
    }
  })

  ctx.all().middleware(async (session, next) => {
    if (session.subtype !== 'private') return next()
    const state = states[session.uid]
    if (state && state[0] === session.content) {
      const user = await session.observeUser<'token' | 'expire'>()
      state[0] = user.token = Random.uuid()
      state[1] = user.expire = Date.now() + TOKEN_LONGTERM
      state[2] = true
    }
    return next()
  }, true)

  ctx.command('status', '查看机器人运行状态')
    .shortcut('你的状态', { prefix: true })
    .shortcut('你的状况', { prefix: true })
    .shortcut('运行情况', { prefix: true })
    .shortcut('运行状态', { prefix: true })
    .option('all', '-a  查看全部平台')
    .action(async ({ session, options }) => {
      const status = { ...await getStatus() }
      if (!options.all) {
        status.bots = status.bots.filter(bot => bot.platform === session.platform)
      }
      status.bots.toString = () => {
        return status.bots.map(bot => {
          let output = interpolate(formatBot, bot)
          if (options.all) output = `[${bot.platform}] ` + output
          return output
        }).join('\n')
      }
      return interpolate(format, status)
    })

  async function _getStatus() {
    const status = await Profile.from(ctx) as Status
    await Promise.all(callbacks.map(callback => callback.call(ctx.app, status, config)))
    status.timestamp = timestamp
    return status
  }

  let cachedStatus: Promise<Status>
  let timestamp: number

  async function getStatus(): Promise<Status> {
    const now = Date.now()
    if (now - timestamp < refresh) return cachedStatus
    timestamp = now
    return cachedStatus = _getStatus()
  }

  ctx.plugin(Profile)
  ctx.plugin(Statistics)
  if (config.port) ctx.plugin(WebUI, config)
}
