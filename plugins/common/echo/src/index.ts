import { Context, h, Schema } from 'koishi'
import { parsePlatform } from '@koishijs/helpers'
import zh from './locales/zh.yml'

export interface Config {}

export const name = 'echo'
export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {
  ctx.i18n.define('zh', zh)

  ctx.command('echo <message:text>')
    .option('escape', '-e', { authority: 3 })
    .option('unescape', '-E', { authority: 3 })
    .option('user', '-u [user:user]', { authority: 3 })
    .option('channel', '-c [channel:channel]', { authority: 3 })
    .option('guild', '-g [guild:string]', { authority: 3 })
    .action(async ({ options, session }, message) => {
      if (!message) return session.text('.expect-text')

      if (options.unescape) {
        message = h.unescape(message)
      }
      if (options.escape) {
        message = h.escape(message)
      }

      const target = options.user || options.channel
      if (target) {
        const [platform, id] = parsePlatform(target)
        const bot = ctx.bots.find(bot => bot.platform === platform)
        if (!bot) {
          return session.text('.platform-not-found')
        } else if (options.user) {
          await bot.sendPrivateMessage(id, message)
        } else {
          await bot.sendMessage(id, message, options.guild)
        }
        return
      }

      return message
    })
}
