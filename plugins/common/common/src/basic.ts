import { Context, Session, noop, sleep, template, makeArray } from 'koishi'
import { parsePlatform } from '@koishijs/command-utils'

template.set('common', {
  'expect-text': '请输入要发送的文本。',
  'expect-command': '请输入要触发的指令。',
  'expect-context': '请提供新的上下文。',
  'platform-not-found': '找不到指定的平台。',
  'invalid-private-member': '无法在私聊上下文使用 --member 选项。',
  'feedback-receive': '收到来自 {0} 的反馈信息：\n{1}',
  'feedback-success': '反馈信息发送成功！',
})

export function contextify(ctx: Context) {
  ctx.command('common/contextify <command:text>', '在特定上下文中触发指令', { authority: 3 })
    .alias('ctxf')
    .userFields(['authority'])
    .option('user', '-u [id:user]  使用用户私聊上下文')
    .option('member', '-m [id:user]  使用当前频道成员上下文')
    .option('channel', '-c [id:channel]  使用群聊上下文')
    .action(async ({ session, options }, message) => {
      if (!message) return template('common.expect-command')

      if (options.member) {
        if (session.subtype === 'private') {
          return template('common.invalid-private-member')
        }
        options.channel = session.cid
        options.user = options.member
      }

      if (!options.user && !options.channel) {
        return template('common.expect-context')
      }

      const sess = new Session(session.bot, session)
      sess.send = session.send.bind(session)
      sess.sendQueued = session.sendQueued.bind(session)

      if (!options.channel) {
        sess.subtype = 'private'
      } else if (options.channel !== session.cid) {
        sess.channelId = parsePlatform(options.channel)[1]
        sess.subtype = 'group'
        await sess.observeChannel()
      } else {
        sess.channel = session.channel
      }

      if (options.user && options.user !== session.uid) {
        sess.userId = sess.author.userId = parsePlatform(options.user)[1]
        const user = await sess.observeUser(['authority'])
        if (session.user.authority <= user.authority) {
          return template('internal.low-authority')
        }
      } else {
        sess.user = session.user
      }

      if (options.member) {
        const info = await session.bot.getGuildMember?.(sess.guildId, sess.userId).catch(() => ({}))
        Object.assign(sess.author, info)
      } else if (options.user) {
        const info = await session.bot.getUser?.(sess.userId).catch(() => ({}))
        Object.assign(sess.author, info)
      }

      await sess.execute(message)
    })
}

export function feedback(ctx: Context, operators: string[]) {
  type FeedbackData = [sid: string, channelId: string, guildId: string]
  const feedbacks: Record<number, FeedbackData> = {}

  ctx.command('common/feedback <message:text>', '发送反馈信息给作者')
    .userFields(['name', 'id'])
    .action(async ({ session }, text) => {
      if (!text) return template('common.expect-text')
      const { username: name, userId } = session
      const nickname = name === '' + userId ? userId : `${name} (${userId})`
      const message = template('common.feedback-receive', nickname, text)
      const delay = ctx.app.options.delay.broadcast
      const data: FeedbackData = [session.sid, session.channelId, session.guildId]
      for (let index = 0; index < operators.length; ++index) {
        if (index && delay) await sleep(delay)
        const [platform, userId] = parsePlatform(operators[index])
        const bot = ctx.bots.find(bot => bot.platform === platform)
        await bot
          .sendPrivateMessage(userId, message)
          .then(id => feedbacks[id] = data, noop)
      }
      return template('common.feedback-success')
    })

  ctx.middleware(async (session, next) => {
    const { quote, parsed } = session
    if (!parsed.content || !quote) return next()
    const data = feedbacks[quote.messageId]
    if (!data) return next()
    await ctx.bots.get(data[0]).sendMessage(data[1], parsed.content, data[2])
  })
}

export interface Respondent {
  match: string | RegExp
  reply: string | ((...capture: string[]) => string)
}

export function respondent(ctx: Context, respondents: Respondent[]) {
  ctx.middleware((session, next) => {
    const message = session.content.trim()
    for (const { match, reply } of respondents) {
      const capture = typeof match === 'string' ? message === match && [message] : message.match(match)
      if (capture) return typeof reply === 'string' ? reply : reply(...capture)
    }
    return next()
  })
}

export interface BasicConfig {
  contextify?: boolean
  operator?: string | string[]
  respondent?: Respondent | Respondent[]
}

export default function apply(ctx: Context, config: BasicConfig = {}) {
  if (config.contextify !== false) ctx.using(['database'], contextify)

  const operators = makeArray(config.operator)
  if (operators.length) ctx.plugin(feedback, operators)

  const respondents = makeArray(config.respondent)
  if (respondents.length) ctx.plugin(respondent, respondents)
}
