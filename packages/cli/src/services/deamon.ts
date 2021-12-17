import { Context, noop, template } from 'koishi'
import { DeamonConfig } from '../..'

template.set('deamon', {
  exiting: '正在关机……',
  restarting: '正在重启……',
  restarted: '已成功重启。',
})

interface Message {
  type: 'send'
  body: any
}

export const name = 'deamon'

export function apply(ctx: Context, config: DeamonConfig = {}) {
  const { exitCommand, autoRestart = true } = config

  function handleSignal(signal: NodeJS.Signals) {
    ctx.logger('app').info(`terminated by ${signal}`)
    ctx.parallel('exit', signal).finally(() => process.exit())
  }

  exitCommand && ctx
    .command(exitCommand === true ? 'exit' : exitCommand, '停止机器人运行', { authority: 4 })
    .option('restart', '-r  重新启动')
    .shortcut('关机', { prefix: true })
    .shortcut('重启', { prefix: true, options: { restart: true } })
    .action(async ({ options, session }) => {
      const { channelId, guildId, sid } = session
      if (!options.restart) {
        await session.send(template('deamon.exiting')).catch(noop)
        process.exit()
      }
      process.send({ type: 'queue', body: { channelId, guildId, sid, message: template('deamon.restarted') } })
      await session.send(template('deamon.restarting')).catch(noop)
      process.exit(114)
    })

  ctx.on('ready', () => {
    process.send({ type: 'start', body: { autoRestart } })
    process.on('SIGINT', handleSignal)
    process.on('SIGTERM', handleSignal)
  })

  process.on('message', (data: Message) => {
    if (data.type === 'send') {
      const { channelId, guildId, sid, message } = data.body
      const bot = ctx.bots.get(sid)
      bot.sendMessage(channelId, message, guildId)
    }
  })
}
