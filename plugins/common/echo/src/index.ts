import { Context, segment, template } from 'koishi'
import { parsePlatform } from '@koishijs/command-utils'

template.set('echo', {
  'expect-text': '请输入要发送的文本。',
  'platform-not-found': '找不到指定的平台。',
})

export const name = 'echo'

export function apply(ctx: Context) {
  ctx.command('echo <message:text>', '向当前上下文发送消息', { authority: 2 })
    .option('anonymous', '-a  匿名发送消息', { authority: 3 })
    .option('forceAnonymous', '-A  匿名发送消息', { authority: 3 })
    .option('escape', '-e  发送转义消息', { authority: 3 })
    .option('user', '-u [user:user]  发送到用户', { authority: 3 })
    .option('channel', '-c [channel:channel]  发送到频道', { authority: 3 })
    .action(async ({ options }, message) => {
      if (!message) return template('echo.expect-text')

      if (options.escape) {
        message = segment.unescape(message)
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
          return template('echo.platform-not-found')
        } else if (options.user) {
          await bot.sendPrivateMessage(id, message)
        } else {
          await bot.sendMessage(id, message, 'unknown')
        }
        return
      }

      return message
    })
}
