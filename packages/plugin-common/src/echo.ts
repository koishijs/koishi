import { MetaTypeMap, Context } from 'koishi-core'
import { CQCode } from 'koishi-utils'

export function apply(ctx: Context) {
  ctx.command('echo <message...>', '向多个上下文发送广播', { authority: 2 })
    .option('anonymous', '-a  匿名发送消息', { authority: 3 })
    .option('forceAnonymous', '-A  匿名发送消息', { authority: 3 })
    .option('unescape', '-e  发送非转义的消息', { authority: 3 })
    .option('user', '-u <id>  指定信息发送的目标 QQ 号', { type: 'string', authority: 4 })
    .option('group', '-g <id>  指定信息发送的目标群号', { type: 'string', authority: 4 })
    .usage('各 id 之间请使用逗号分隔。')
    .action(async ({ options, session }, message) => {
      // parse channels
      const channels: Record<MetaTypeMap['message'], number[]> = {
        private: options.user ? options.user.split(',').map(Number) : [],
        group: options.group ? options.group.split(',').map(Number) : [],
      }

      // fallback to current context
      if (!channels.private.length && !channels.group.length) {
        channels[session.messageType].push(session.messageType === 'private' ? session.userId : session[session.messageType + 'Id'])
      }

      if (options.unescape) {
        message = CQCode.unescape(message)
      }

      if (options.forceAnonymous) {
        message = CQCode.stringify('anonymous') + message
      } else if (options.anonymous) {
        message = CQCode.stringify('anonymous', { ignore: true }) + message
      }

      // send messages
      await Promise.all([
        session.$bot.sendPrivateMessage(channels.private, message),
        session.$bot.sendGroupMessage(channels.group, message),
      ])
    })
}
