import { Context, template, Time, Tables, Awaitable, Schema } from 'koishi'
import { Synchronizer } from './payload/stats'
import { StatusServer, SocketHandle, Config } from './server'
import Meta from './payload/meta'

import './database/mongo'
import './database/mysql'

export * from './payload'
export * from './server'

export type Activity = Record<number, number>

declare module 'koishi' {
  namespace Context {
    interface Services {
      webui: StatusServer
    }
  }

  interface Database {
    stats(): Promise<Meta.Stats>
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
    'status/validate'(handle: SocketHandle): Awaitable<boolean>
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

  interface Modules {
    console: typeof import('.')
  }
}

Context.service('webui')

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
  uiPath: '',
  selfUrl: '',
  tickInterval: Time.second * 5,
  statsInternal: Time.minute * 10,
  metaInterval: Time.hour,
}

export const name = 'status'

export const schema: Schema<Config> = Schema.object({
  uiPath: Schema.string('前端页面呈现的路径。').default(''),
  apiPath: Schema.string('后端 API 服务的路径。').default('/status'),
  selfUrl: Schema.string('Koishi 服务暴露在公网的地址。').comment('与其他需要 selfUrl 配置项的地方不同的是，这里的属性不会继承 app.options.selfUrl 的值。这是因为，由于这里缺省时会使用相对路径，网页依旧可以正常访问。只有你将 uiPath 和 apiPath 分别部署到了不同的端口或域名时，这个选项才建议使用。'),
  open: Schema.boolean('在应用启动后自动在浏览器中打开控制台。'),
  devMode: Schema.boolean('启用调试模式（仅供开发者使用）。'),
})

export function apply(ctx: Context, config: Config = {}) {
  config = Object.assign(defaultConfig, config)

  ctx.webui = new StatusServer(ctx, config)

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
