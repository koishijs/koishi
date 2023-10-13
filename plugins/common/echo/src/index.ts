import { Context, h, Schema } from 'koishi'
import zhCN from './locales/zh-CN.yml'

export function parsePlatform(target: string): [platform: string, id: string] {
  const index = target.indexOf(':')
  const platform = target.slice(0, index)
  const id = target.slice(index + 1)
  return [platform, id] as any
}

export interface Config {}

export const name = 'echo'
export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context, config: Config) {
  ctx.i18n.define('zh-CN', zhCN)

  ctx.command('echo <message:text>')
    .option('escape', '-e', { authority: 3 })
    .option('unescape', '-E', { authority: 3 })
    .option('user', '-u [user:user]', { authority: 3 })
    .option('channel', '-c [channel:channel]', { authority: 3 })
    .option('guild', '-g [guild:string]', { authority: 3 })
    .action(async ({ options, session }, message) => {
      if (!message) return session.text('.expect-text')

      // use Array to prevent unescape
      let content: any = [message]
      if (options.unescape) {
        content = h.parse(message)
      } else if (options.escape) {
        content = [h.escape(message)]
      }

      const target = options.user || options.channel
      if (target) {
        const [platform, id] = parsePlatform(target)
        const bot = ctx.bots.find(bot => bot.platform === platform)
        if (!bot) {
          return session.text('.platform-not-found')
        } else if (options.user) {
          await bot.sendPrivateMessage(id, content)
        } else {
          await bot.sendMessage(id, content, options.guild)
        }
        return
      }

      return content
    })
}
