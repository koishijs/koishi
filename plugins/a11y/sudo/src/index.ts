import { Context, Schema, Session } from 'koishi'
import { parsePlatform } from '@koishijs/helpers'
import zh from './locales/zh.yml'

export interface Config {}

export const name = 'sudo'
export const using = ['database'] as const
export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {
  ctx.i18n.define('zh', zh)

  ctx.command('sudo <command:text>', { authority: 3 })
    .userFields(['authority'])
    .option('user', '-u [id:user]')
    .option('member', '-m [id:user]')
    .option('channel', '-c [id:channel]')
    .action(async ({ session, options }, message) => {
      if (!message) return session.text('.expect-command')

      if (options.member) {
        if (session.subtype === 'private') {
          return session.text('.invalid-private-member')
        }
        options.channel = session.cid
        options.user = options.member
      }

      if (!options.user && !options.channel) {
        return session.text('.expect-context')
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
          return session.text('internal.low-authority')
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
