import { Context, appMap } from 'koishi-core'
import { sleep } from 'koishi-utils'

export interface BroadcastOptions {
  broadcastInterval?: number
}

const defaultOptions: BroadcastOptions = {
  broadcastInterval: 1000,
}

export default function apply (ctx: Context, options: BroadcastOptions = {}) {
  options = { ...defaultOptions, ...options }

  ctx.command('broadcast <message...>', '全服广播', { authority: 4 })
    .action(async (_, message: string) => {
      const groups = await ctx.database.getAllGroups(['id', 'assignee'])
      const assignMap: Record<number, number[]> = {}
      for (const { id, assignee } of groups) {
        if (!assignMap[assignee]) {
          assignMap[assignee] = [id]
        } else {
          assignMap[assignee].push(id)
        }
      }
      Object.keys(assignMap).forEach(async (id: any) => {
        const groups = assignMap[id]
        const { sender } = appMap[id]
        for (let index = 0; index < groups.length; index++) {
          if (index) await sleep(options.broadcastInterval)
          sender.sendGroupMsgAsync(groups[index], message)
        }
      })
    })
}
