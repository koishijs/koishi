import { Context, Group } from 'koishi-core'

export function apply(ctx: Context) {
  ctx.command('broadcast <message...>', '全服广播', { authority: 4 })
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
}
