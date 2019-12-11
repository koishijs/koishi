import { App, Meta } from 'koishi-core'

export type WelcomeMessage = string | ((meta: Meta<'notice'>) => string | Promise<string>)

const defaultMessage = (meta: Meta<'notice'>) => `欢迎新大佬 [CQ:at,qq=${meta.userId}]！`

export default function apply (ctx: App, message: WelcomeMessage = defaultMessage) {
  ctx.receiver.on('group_increase', async (meta) => {
    const group = await ctx.database.getGroup(meta.groupId, 0, ['assignee'])
    if (group.assignee !== ctx.options.selfId || ctx.options.selfId === meta.userId) return
    await ctx.sender.sendGroupMsg(meta.groupId, typeof message === 'string' ? message : await message(meta))
  })
}
