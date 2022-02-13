import { Context, Dict, Schema, sleep, template, Time } from 'koishi'
import { parsePlatform } from '@koishijs/helpers'

template.set('feedback', {
  'expect-text': '请输入要发送的文本。',
  'receive': '收到来自 {0} 的反馈信息：\n{1}',
  'success': '反馈信息发送成功！',
})

export interface Config {
  operators?: string[]
  replyTimeout?: number
}

export const schema: Schema<string[] | Config, Config> = Schema.union([
  Schema.object({
    operators: Schema.array(Schema.string()).description('接收反馈信息的管理员。'),
  }),
  Schema.transform(Schema.array(Schema.string()), (operators) => ({ operators })),
])

export const name = 'feedback'

export function apply(ctx: Context, { operators = [], replyTimeout = Time.day }: Config) {
  type FeedbackData = [sid: string, channelId: string, guildId: string]
  const feedbacks: Dict<FeedbackData> = {}

  ctx.command('feedback <message:text>', '发送反馈信息给作者')
    .userFields(['name', 'id'])
    .action(async ({ session }, text) => {
      if (!text) return template('feedback.expect-text')
      const { username: name, userId } = session
      const nickname = name === '' + userId ? userId : `${name} (${userId})`
      const message = template('feedback.receive', nickname, text)
      const delay = ctx.app.options.delay.broadcast
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
      return template('feedback.success')
    })

  ctx.middleware(async (session, next) => {
    const { quote, parsed } = session
    if (!parsed.content || !quote) return next()
    const data = feedbacks[quote.messageId]
    if (!data) return next()
    await ctx.bots.get(data[0]).sendMessage(data[1], parsed.content, data[2])
  })
}
