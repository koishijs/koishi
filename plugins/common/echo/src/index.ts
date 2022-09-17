import { Context, Schema, segment } from 'koishi'
import { parsePlatform } from '@koishijs/helpers'
import zh from './locales/zh.yml'

export interface Config {}

export const name = 'echo'
export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {
  ctx.i18n.define('zh', zh)

  ctx.command('echo <message:text>', { authority: 2 })
    .option('anonymous', '-a', { authority: 3 })
    .option('forceAnonymous', '-A', { authority: 3 })
    .option('escape', '-e', { authority: 3 })
    .option('unescape', '-E', { authority: 3 })
    .option('user', '-u [user:user]', { authority: 3 })
    .option('channel', '-c [channel:channel]', { authority: 3 })
    .option('guild', '-g [guild:string]', { authority: 3 })
    .action(async ({ options, session }, message) => {
      if (!message) return session.text('.expect-text')

      if (options.unescape) {
        message = segment.unescape(message)
      }
      if (options.escape) {
        message = segment.escape(message)
      }

      if (options.forceAnonymous) {
        message = segment('anonymous') + message
      } else if (options.anonymous) {
        message = segment('anonymous', { ignore: true }) + message
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
