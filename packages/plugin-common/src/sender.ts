import { Context, Group } from 'koishi-core'
import { CQCode } from 'koishi-utils'

export interface SenderConfig {
  broadcast?: false
  echo?: false
}

export default function apply(ctx: Context, config: SenderConfig = {}) {
  config.broadcast !== false && ctx
    .command('broadcast <message...>', '全服广播', { authority: 4 })
    .before(session => !session.$app.database)
    .option('forced', '-f  无视 silent 标签进行广播')
    .option('only', '-o  仅向当前 Bot 负责的群进行广播')
    .action(async ({ options, session }, message) => {
      if (!message) return '请输入要发送的文本。'
      if (!options.only) {
        await ctx.broadcast(message, options.forced)
        return
      }

      let groups = await ctx.database.getAllGroups(['id', 'flag'], [session.selfId])
      if (!options.forced) {
        groups = groups.filter(g => !(g.flag & Group.Flag.silent))
      }
      await session.$bot.broadcast(groups.map(g => g.id), message)
    })

  config.echo !== false && ctx
    .command('echo <message...>', '向当前上下文发送消息', { authority: 2 })
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
