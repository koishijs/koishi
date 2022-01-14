import { Context, Session, template } from 'koishi'
import { parsePlatform } from '@koishijs/command-utils'

template.set('sudo', {
  'expect-command': '请输入要触发的指令。',
  'expect-context': '请提供新的上下文。',
  'invalid-private-member': '无法在私聊上下文使用 --member 选项。',
})

export const name = 'sudo'
export const using = ['database'] as const

export function apply(ctx: Context) {
  ctx.command('sudo <command:text>', '在特定上下文中触发指令', { authority: 3 })
    .userFields(['authority'])
    .option('user', '-u [id:user]  使用用户私聊上下文')
    .option('member', '-m [id:user]  使用当前频道成员上下文')
    .option('channel', '-c [id:channel]  使用群聊上下文')
    .action(async ({ session, options }, message) => {
      if (!message) return template('sudo.expect-command')

      if (options.member) {
        if (session.subtype === 'private') {
          return template('sudo.invalid-private-member')
        }
        options.channel = session.cid
        options.user = options.member
      }

      if (!options.user && !options.channel) {
        return template('sudo.expect-context')
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
