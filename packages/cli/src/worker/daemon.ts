import { Context, noop, Schema } from 'koishi'
import zhCN from '../locales/zh-CN.yml'
import jaJP from '../locales/ja-JP.yml'
import frFR from '../locales/fr-FR.yml'
import zhTW from '../locales/zh-TW.yml'

declare module 'koishi' {
  interface SharedData {
    startMessage: StartMessage
  }
}

interface StartMessage {
  channelId: string
  guildId: string
  sid: string
  message: string
}

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

  ctx.i18n.define('zh', zhCN)
  ctx.i18n.define('ja', jaJP)
  ctx.i18n.define('fr', frFR)
  ctx.i18n.define('zh-TW', zhTW)

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
      await session.send(session.text('.restarting')).catch(noop)
      ctx.shared.startMessage = { channelId, guildId, sid, message: session.text('.restarted') }
      ctx.loader.fullReload()
    })

  ctx.on('ready', () => {
    process.send({ type: 'start', body: config })
    process.on('SIGINT', handleSignal)
    process.on('SIGTERM', handleSignal)

    config.heartbeatInterval && setInterval(() => {
      process.send({ type: 'heartbeat' })
    }, config.heartbeatInterval)

    if (ctx.shared.startMessage) {
      const { channelId, guildId, sid, message } = ctx.shared.startMessage
      const dispose = ctx.on('bot-status-updated', (bot) => {
        if (bot.sid !== sid || bot.status !== 'online') return
        bot.sendMessage(channelId, message, guildId)
        dispose()
      })
      ctx.shared.startMessage = null
    }
  })
}
