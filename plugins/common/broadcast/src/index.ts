import { Channel, Context, template } from 'koishi'

template.set('broadcast', {
  'expect-text': '请输入要发送的文本。',
})

export const name = 'broadcast'
export const using = ['database'] as const

export function apply(ctx: Context) {
  ctx.command('broadcast <message:text>', '全服广播', { authority: 4 })
    .option('forced', '-f  无视 silent 标签进行广播')
    .option('only', '-o  仅向当前账号负责的群进行广播')
    .action(async ({ options, session }, message) => {
      if (!message) return template('broadcast.expect-text')
      if (!options.only) {
        await ctx.broadcast(message, options.forced)
        return
      }

      const fields: ('id' | 'flag')[] = ['id']
      if (!options.forced) fields.push('flag')
      let channels = await ctx.database.getAssignedChannels(fields, { [session.platform]: [session.selfId] })
      if (!options.forced) {
        channels = channels.filter(g => !(g.flag & Channel.Flag.silent))
      }
      await session.bot.broadcast(channels.map(channel => channel.id), message)
    })
}
