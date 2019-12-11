import { Context, appMap, CommandConfig } from 'koishi-core'
import { sleep } from 'koishi-utils'

export interface BroadcastOptions extends CommandConfig {
  broadcastInterval?: number
}

const defaultOptions: BroadcastOptions = {
  authority: 4,
  broadcastInterval: 1000,
}

export default function apply (ctx: Context, options: BroadcastOptions = {}) {
  ctx.command('broadcast <message...>', '全服广播', { ...defaultOptions, ...options })
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
          await sender.sendGroupMsg(groups[index], message)
        }
      })
    })
}
