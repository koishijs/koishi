import { Context, appMap } from 'koishi-core'
import { sleep } from 'koishi-utils'

export interface BroadcastOptions {
  broadcastInterval?: number
}

const defaultOptions: BroadcastOptions = {
  broadcastInterval: 1000,
}

export default function apply (ctx: Context, config: BroadcastOptions = {}) {
  config = { ...defaultOptions, ...config }

  async function broadcast (selfId: string | number, groups: number[], message: string) {
    const { sender } = appMap[selfId]
    for (let index = 0; index < groups.length; index++) {
      if (index) await sleep(config.broadcastInterval)
      sender.sendGroupMsgAsync(groups[index], message)
    }
  }

  ctx.command('broadcast <message...>', '全服广播', { authority: 4 })
    .option('-o, --only', '仅向当前 Bot 负责的群进行广播')
    .action(async ({ options, meta }, message) => {
      if (!message) return meta.$send('请输入要发送的文本。')

      if (options.only) {
        const groups = await ctx.database.getAllGroups(['id'], [ctx.app.selfId])
        return broadcast(ctx.app.selfId, groups.map(g => g.id), message)
      }

      const groups = await ctx.database.getAllGroups(['id', 'assignee'])
      const assignMap: Record<number, number[]> = {}
      for (const { id, assignee } of groups) {
        if (!assignMap[assignee]) {
          assignMap[assignee] = [id]
        } else {
          assignMap[assignee].push(id)
        }
      }
      return Promise.all(Object.keys(assignMap).map(id => broadcast(id, assignMap[id], message)))
    })
}
