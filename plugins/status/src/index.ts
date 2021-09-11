import { Context, template, Time, Tables } from 'koishi'
import { Synchronizer } from './payload/stats'
import { WebServer, Config } from './server'
import Meta from './payload/meta'

import './database/mongo'
import './database/mysql'

export * from './server'

export type Activity = Record<number, number>

declare module 'koishi' {
  namespace Context {
    interface Delegates {
      webui: WebServer
    }
  }

  interface Database {
    getStats(): Promise<Meta.Stats>
    createSynchronizer(): Synchronizer
  }

  interface Session {
    _sendType?: 'command' | 'dialogue'
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

  interface Loader {
    status: typeof import('.')
  }
}

Context.delegate('webui')

Tables.extend('user', {
  lastCall: 'timestamp',
  password: 'string(63)',
  token: 'string(63)',
  expire: 'unsigned(20)',
})

Tables.extend('channel', {
  name: 'string(50)',
  activity: 'json',
})

template.set('status', {
  // eslint-disable-next-line no-template-curly-in-string
  bot: '{{ username }}：{{ code ? `无法连接` : `工作中（${currentRate[0]}/min）` }}',
  output: [
    '{{ bots }}',
    '==========',
    'CPU 使用率：{{ (cpu[0] * 100).toFixed() }}% / {{ (cpu[1] * 100).toFixed() }}%',
    '内存使用率：{{ (memory[0] * 100).toFixed() }}% / {{ (memory[1] * 100).toFixed() }}%',
  ].join('\n'),
})

const defaultConfig: Config = {
  apiPath: '/status',
  uiPath: '/console',
  selfUrl: '',
  title: 'Koishi 控制台',
  expiration: Time.week,
  tickInterval: Time.second * 5,
  statsInternal: Time.minute * 10,
  metaInterval: Time.hour,
}

export const name = 'status'

export function apply(ctx: Context, config: Config = {}) {
  config = Object.assign(defaultConfig, config)

  ctx.webui = new WebServer(ctx, config)

  ctx.router.get(config.apiPath, async (ctx) => {
    ctx.set('Access-Control-Allow-Origin', '*')
    ctx.body = await getStatus()
  })

  ctx.command('status', '查看机器人运行状态')
    .shortcut('你的状态', { prefix: true })
    .shortcut('你的状况', { prefix: true })
    .shortcut('运行情况', { prefix: true })
    .shortcut('运行状态', { prefix: true })
    .option('all', '-a  查看全部平台')
    .action(async ({ session, options }) => {
      const status = await getStatus()
      if (!options.all) {
        status.bots = status.bots.filter(bot => bot.platform === session.platform)
      }
      status.bots.toString = () => {
        return status.bots.map(bot => {
          let output = template('status.bot', bot)
          if (options.all) output = `[${bot.platform}] ` + output
          return output
        }).join('\n')
      }
      return template('status.output', status)
    })

  async function getStatus() {
    const [profile, meta] = await Promise.all([
      ctx.webui.sources.profile.get(),
      ctx.webui.sources.meta.get(),
    ])
    return { ...profile, ...meta }
  }
}
