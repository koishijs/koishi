import { Context, getSenderName, CommandConfig, UserType } from 'koishi-core'

export interface LikemeOptions extends CommandConfig {
  likes?: UserType<number>
}

export default function apply (ctx: Context, config: LikemeOptions = {}) {
  ctx.command('likeme', '让四季酱点赞', { maxUsage: 1, ...config })
    .alias('给我点赞')
    .alias('为我点赞')
    .action(async ({ meta }) => {
      const times = typeof config.likes === 'function' ? config.likes(meta.$user, meta) : config.likes
      if (!times) return meta.$send(`${getSenderName(meta)}，你的好感度过低，四季酱无法为你点赞。`)
      try {
        await ctx.sender.sendLike(meta.userId, times)
        return meta.$send(`${getSenderName(meta)}，四季酱已为你点赞 ${times} 次。`)
      } catch (error) {
        return meta.$send('操作时发生异常。')
      }
    })
}
