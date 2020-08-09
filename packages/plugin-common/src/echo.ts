import { MetaTypeMap, Context } from 'koishi-core'
import { CQCode } from 'koishi-utils'

export function apply (ctx: Context) {
  ctx.command('echo <message...>', '向多个上下文发送广播', { authority: 2 })
    .option('anonymous', '-a, --anonymous  匿名发送消息', { authority: 3 })
    .option('forceAnonymous', '-A, --force-anonymous  匿名发送消息', { authority: 3 })
    .option('unescape', '-e, --unescape  发送非转义的消息', { authority: 3 })
    .option('user', '-u, --user <id>  指定信息发送的目标 QQ 号', { type: 'string', authority: 4 })
    .option('group', '-g, --group <id>  指定信息发送的目标群号', { type: 'string', authority: 4 })
    .usage('各 id 之间请使用逗号分隔。')
    .action(async ({ options, session }, message) => {
      // parse channels
      const channels: Record<MetaTypeMap['message'], string[]> = {
        private: options.user ? options.user.split(',') : [],
        group: options.group ? options.group.split(',') : [],
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
        ...channels.private.map(id => session.$bot.sendPrivateMsg(+id, message)),
        ...channels.group.map(id => session.$bot.sendGroupMsg(+id, message)),
      ])
    })
}
