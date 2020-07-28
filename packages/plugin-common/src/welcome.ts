import { Meta, Context } from 'koishi-core'

export type WelcomeMessage = string | ((meta: Meta) => string | Promise<string>)

const defaultMessage = (meta: Meta) => `欢迎新大佬 [CQ:at,qq=${meta.userId}]！`

export default function apply (ctx: Context, message: WelcomeMessage = defaultMessage) {
  ctx.on('group-increase', async (meta) => {
    if (meta.userId === meta.selfId) return
    if (ctx.database) {
      const group = await ctx.database.getGroup(meta.groupId, 0, ['assignee'])
      if (group.assignee !== meta.selfId) return
    }
    const output = typeof message === 'string' ? message : await message(meta)
    await ctx.sender(meta.selfId).sendGroupMsg(meta.groupId, output)
  })
}
