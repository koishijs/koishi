import { Context, Dict, Schema, sleep } from 'koishi'

export interface Config {
  recall?: number
}

export const Config = Schema.object({
  recall: Schema.number().default(10),
})

export const name = 'recall'

export function apply(ctx: Context, { recall }: Config) {
  ctx = ctx.guild()
  const recent: Dict<string[]> = {}

  ctx.on('send', (session) => {
    const list = recent[session.channelId] ||= []
    list.unshift(session.messageId)
    if (list.length > recall) {
      list.pop()
    }
  })

  ctx.command('recall [count:number]', '撤回 bot 发送的消息', { authority: 2 })
    .action(async ({ session }, count = 1) => {
      const list = recent[session.channelId]
      if (!list) return '近期没有发送消息。'
      const removal = list.splice(0, count)
      const delay = ctx.app.options.delay.broadcast
      if (!list.length) delete recent[session.channelId]
      for (let index = 0; index < removal.length; index++) {
        if (index && delay) await sleep(delay)
        try {
          await session.bot.deleteMessage(session.channelId, removal[index])
        } catch (error) {
          ctx.logger('bot').warn(error)
        }
      }
    })
}
