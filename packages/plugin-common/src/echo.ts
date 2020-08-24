import { Context } from 'koishi-core'
import { CQCode } from 'koishi-utils'

export function apply(ctx: Context) {
  ctx.command('echo <message...>', '向当前上下文发送消息', { authority: 2 })
    .option('anonymous', '-a  匿名发送消息', { authority: 3 })
    .option('forceAnonymous', '-A  匿名发送消息', { authority: 3 })
    .option('unescape', '-e  发送非转义的消息', { authority: 3 })
    .action(async ({ options }, message) => {
      if (!message) return '请输入要发送的文本。'

      if (options.unescape) {
        message = CQCode.unescape(message)
      }

      if (options.forceAnonymous) {
        message = CQCode.stringify('anonymous') + message
      } else if (options.anonymous) {
        message = CQCode.stringify('anonymous', { ignore: true }) + message
      }

      return message
    })
}
