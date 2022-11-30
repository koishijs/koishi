import Loader from '@koishijs/loader'
import { Context, noop, Schema } from 'koishi'

export interface Config {
  exitCommand?: boolean
  autoRestart?: boolean
  heartbeatInterval?: number
  heartbeatTimeout?: number
}

export const Config: Schema<Config> = Schema.object({
  exitCommand: Schema.boolean().description('提供退出指令。').default(false),
  autoRestart: Schema.boolean().description('在运行时崩溃自动重启。').default(true),
  heartbeatInterval: Schema.number().description('心跳发送间隔。').default(0),
  heartbeatTimeout: Schema.number().description('心跳超时时间。').default(0),
}).description('守护设置')

Context.Config.list.push(Schema.object({
  daemon: Config,
}))

export type Event = Event.Start | Event.Exit | Event.Heartbeat

export namespace Event {
  export interface Start {
    type: 'start'
    body: Config
  }

  export interface Exit {
    type: 'exit'
    body: any
  }

  export interface Heartbeat {
    type: 'heartbeat'
  }
}

interface Message {
  type: 'send'
  body: any
}

export const name = 'daemon'

export function apply(ctx: Context, config: Config = {}) {
  function handleSignal(signal: NodeJS.Signals) {
    // prevent restarting when child process is exiting
    if (config.autoRestart) {
      process.send({ type: 'exit' })
    }
    ctx.logger('app').info(`terminated by ${signal}`)
    ctx.parallel('exit', signal).finally(() => process.exit())
  }

  ctx.i18n.define('zh', require('../locales/zh'))
  ctx.i18n.define('ja', require('../locales/ja'))
  ctx.i18n.define('fr', require('../locales/fr'))
  ctx.i18n.define('zh-tw', require('../locales/zh-tw'))

  ctx
    .intersect(() => config.exitCommand)
    .command('exit', { authority: 4 })
    .option('restart', '-r')
    .action(async ({ options, session }) => {
      const { channelId, guildId, sid } = session
      if (!options.restart) {
        await session.send(session.text('.exiting')).catch(noop)
        process.exit()
      }
      process.send({ type: 'exit', body: { channelId, guildId, sid, message: session.text('.restarted') } })
      await session.send(session.text('.restarting')).catch(noop)
      process.exit(Loader.exitCode)
    })

  ctx.on('ready', () => {
    process.send({ type: 'start', body: config })
    process.on('SIGINT', handleSignal)
    process.on('SIGTERM', handleSignal)

    config.heartbeatInterval && setInterval(() => {
      process.send({ type: 'heartbeat' })
    }, config.heartbeatInterval)
  })

  process.on('message', (data: Message) => {
    if (data.type === 'send') {
      const { channelId, guildId, sid, message } = data.body
      const dispose = ctx.on('bot-status-updated', (bot) => {
        if (bot.sid !== sid || bot.status !== 'online') return
        bot.sendMessage(channelId, message, guildId)
        dispose()
      })
    }
  })
}
