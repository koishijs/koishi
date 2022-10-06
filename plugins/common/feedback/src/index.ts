import { Context, Dict, Schema, sleep, Time } from 'koishi'
import { parsePlatform } from '@koishijs/helpers'
import zh from './locales/zh.yml'

export interface Config {
  operators?: string[]
  replyTimeout?: number
}

export const schema: Schema<string[] | Config, Config> = Schema.union([
  Schema.object({
    operators: Schema.array(String).description('接收反馈信息的管理员。'),
  }),
  Schema.transform(Schema.array(String), (operators) => ({ operators })),
])

export const name = 'feedback'

export function apply(ctx: Context, { operators = [], replyTimeout = Time.day }: Config) {
  ctx.i18n.define('zh', zh)

  type FeedbackData = [sid: string, channelId: string, guildId: string]
  const feedbacks: Dict<FeedbackData> = {}

  ctx.command('feedback <message:text>')
    .userFields(['name', 'id'])
    .action(async ({ session }, text) => {
      if (!text) return session.text('.expect-text')
      const { username: name, userId } = session
      const nickname = name === '' + userId ? userId : `${name} (${userId})`
      const message = session.text('.receive', [nickname, text])
      const delay = ctx.root.config.delay.broadcast
      const data: FeedbackData = [session.sid, session.channelId, session.guildId]
      for (let index = 0; index < operators.length; ++index) {
        if (index && delay) await sleep(delay)
        const [platform, userId] = parsePlatform(operators[index])
        const bot = ctx.bots.find(bot => bot.platform === platform)
        await bot.sendPrivateMessage(userId, message).then((ids) => {
          for (const id of ids) {
            feedbacks[id] = data
            ctx.setTimeout(() => delete feedbacks[id], replyTimeout)
          }
        }, (error) => {
          ctx.logger('bot').warn(error)
        })
      }
      return session.text('.success')
    })

  ctx.middleware(async (session, next) => {
    const { quote, parsed } = session
    if (!parsed.content || !quote) return next()
    const data = feedbacks[quote.messageId]
    if (!data) return next()
    await ctx.bots[data[0]].sendMessage(data[1], parsed.content, data[2])
  })
}
