import { Bot, Context, Dict, remove, Schema, sleep, Time } from 'koishi'
import zh from './locales/zh.yml'

export interface Config {
  timeout?: number
}

export const Config: Schema<Config> = Schema.object({
  timeout: Schema.natural().role('ms').default(Time.hour).description('消息保留的时间。'),
})

export const name = 'recall'

export function apply(ctx: Context, { timeout }: Config) {
  const logger = ctx.logger('recall')
  ctx.i18n.define('zh', zh)

  ctx = ctx.guild()
  const recent: Dict<string[]> = {}

  ctx.on('send', (session) => {
    const list = recent[session.channelId] ||= []
    list.unshift(session.messageId)
    ctx.setTimeout(() => remove(list, session.messageId), timeout)
  })

  ctx.command('recall [count:number]', { authority: 2 })
    .action(async ({ session }, count = 1) => {
      const list = recent[session.channelId]
      if (session.quote) {
        const index = list?.findIndex(id => id === session.quote.messageId)
        if (index) list.splice(index, 1)
        await deleteMessage(session.bot, session.channelId, session.quote.messageId)
        return
      }
      if (!list) return session.text('.no-recent')
      const removal = list.splice(0, count)
      const delay = ctx.root.config.delay.broadcast
      if (!list.length) delete recent[session.channelId]
      for (let index = 0; index < removal.length; index++) {
        if (index && delay) await sleep(delay)
        await deleteMessage(session.bot, session.channelId, removal[index])
      }
    })

  async function deleteMessage(bot: Bot, channelId: string, messageId: string) {
    try {
      await bot.deleteMessage(channelId, messageId)
    } catch (error) {
      logger.warn(error)
    }
  }
}
