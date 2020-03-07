import { Context, appMap, GroupFlag } from 'koishi-core'
import { sleep } from 'koishi-utils'

export interface BroadcastOptions {
  broadcastInterval?: number
}

const defaultOptions: BroadcastOptions = {
  broadcastInterval: 1000,
}

export default function apply (ctx: Context, config: BroadcastOptions = {}) {
  config = { ...defaultOptions, ...config }

  async function broadcast (selfId: string | number, groupIds: number[], message: string) {
    const { sender } = appMap[selfId]
    for (let index = 0; index < groupIds.length; index++) {
      if (index) await sleep(config.broadcastInterval)
      sender.sendGroupMsgAsync(groupIds[index], message)
    }
  }

  ctx.command('broadcast <message...>', '全服广播', { authority: 4 })
    .option('-f, --forced', '无视 noEmit 标签进行广播')
    .option('-o, --only', '仅向当前 Bot 负责的群进行广播')
    .action(async ({ options, meta }, message) => {
      if (!message) return meta.$send('请输入要发送的文本。')

      if (options.only) {
        let groups = await ctx.database.getAllGroups(['id', 'flag'], [ctx.app.selfId])
        if (!options.forced) {
          groups = groups.filter(g => !(g.flag & GroupFlag.noEmit))
        }
        return broadcast(ctx.app.selfId, groups.map(g => g.id), message)
      }

      const groups = await ctx.database.getAllGroups(['id', 'assignee', 'flag'])
      const assignMap: Record<number, number[]> = {}
      for (const { id, assignee, flag } of groups) {
        if (!options.forced && (flag & GroupFlag.noEmit)) continue
        if (!assignMap[assignee]) {
          assignMap[assignee] = [id]
        } else {
          assignMap[assignee].push(id)
        }
      }
      return Promise.all(Object.keys(assignMap).map(id => broadcast(id, assignMap[id], message)))
    })
}
