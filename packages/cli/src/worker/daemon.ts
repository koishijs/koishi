import { Context, noop } from 'koishi'

export interface Config {
  exitCommand?: boolean
  autoRestart?: boolean
}

interface Message {
  type: 'send'
  body: any
}

export const name = 'daemon'

export function apply(ctx: Context, config: Config = {}) {
  const { exitCommand, autoRestart = true } = config

  function handleSignal(signal: NodeJS.Signals) {
    // prevent restarting when child process is exiting
    if (autoRestart) {
      process.send({ type: 'start', body: { autoRestart: false } })
    }
    ctx.logger('app').info(`terminated by ${signal}`)
    ctx.parallel('exit', signal).finally(() => process.exit())
  }

  if (exitCommand) {
    ctx.i18n.define('zh', require('../locales/zh'))
    ctx.i18n.define('ja', require('../locales/ja'))
    ctx.i18n.define('fr', require('../locales/fr'))
    ctx.i18n.define('zh-tw', require('../locales/zh-tw'))

    ctx
      .command('exit', { authority: 4 })
      .option('restart', '-r')
      .action(async ({ options, session }) => {
        const { channelId, guildId, sid } = session
        if (!options.restart) {
          await session.send(session.text('.exiting')).catch(noop)
          process.exit()
        }
        process.send({ type: 'queue', body: { channelId, guildId, sid, message: session.text('.restarted') } })
        await session.send(session.text('.restarting')).catch(noop)
        process.exit(51)
      })
  }

  ctx.on('ready', () => {
    process.send({ type: 'start', body: { autoRestart } })
    process.on('SIGINT', handleSignal)
    process.on('SIGTERM', handleSignal)
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
