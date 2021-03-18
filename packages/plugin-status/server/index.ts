import { Context, Channel, App, Argv, User } from 'koishi-core'
import { interpolate, Time } from 'koishi-utils'
import * as WebUI from './webui'
import Profile from './profile'
import Statistics, { Synchronizer } from './stats'
import { WebBot } from './adapter'

import './mongo'
import './mysql'

export type Activity = Record<number, number>

declare module 'koishi-core' {
  interface App {
    synchronizer: Synchronizer
  }

  interface Database {
    getProfile(): Promise<Profile.Meta>
    setChannels(data: Partial<Channel>[]): Promise<void>
    Synchronizer: new (db: Database) => Synchronizer
  }

  interface Session {
    _sendType?: 'command' | 'dialogue'
  }

  namespace Bot {
    interface Platforms {
      'sandbox': WebBot
    }
  }

  interface Bot {
    messageSent: number[]
    messageReceived: number[]
  }

  interface EventMap {
    'status/tick'(): void
  }

  interface User {
    lastCall: Date
    password: string
    token: string
    expire: number
  }

  interface Channel {
    name: string
    activity: Activity
  }
}

Channel.extend(() => ({
  activity: {},
}))

User.extend(() => ({
  expire: 0,
}))

export interface Config extends WebUI.Config {
  format?: string
  formatBot?: string
}

export interface Status extends Profile {}

type StatusCallback = (this: App, status: Status, config: Config) => void | Promise<void>
const callbacks: StatusCallback[] = []

export function extend(callback: StatusCallback) {
  callbacks.push(callback)
}

extend(async function (status) {
  if (!this.database) return
  Object.assign(status, await this.database.getProfile())
})

const defaultConfig: Config = {
  apiPath: '/status',
  uiPath: '/console',
  expiration: Time.week,
  tickInterval: Time.second * 5,
  refreshInterval: Time.hour,
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

export const name = 'status'

export function apply(ctx: Context, config: Config = {}) {
  config = Object.assign(defaultConfig, config)
  const { apiPath, formatBot, format } = config

  ctx.all().on('command', ({ session }: Argv<'lastCall'>) => {
    session.user.lastCall = new Date()
  })

  ctx.router?.get(apiPath, async (koa) => {
    koa.set('Access-Control-Allow-Origin', '*')
    koa.body = await getStatus()
  })

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

  async function getStatus() {
    const status = await Profile.get(ctx, config) as Status
    await Promise.all(callbacks.map(callback => callback.call(ctx.app, status, config)))
    return status
  }

  ctx.plugin(Profile, config)
  ctx.plugin(Statistics, config)
  ctx.plugin(WebUI, config)
}
