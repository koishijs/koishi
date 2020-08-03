import { Context, Group, CQSender } from 'koishi-core'
import { sleep } from 'koishi-utils'
import axios from 'axios'

declare module 'koishi-core/dist/app' {
  interface AppOptions {
    broadcastInterval?: number
  }
}

declare module 'koishi-core/dist/context' {
  interface Context {
    broadcast (message: string, forced?: boolean): Promise<void>
  }
}

declare module 'koishi-core/dist/sender' {
  interface CQSender {
    sendGroupMsgAsync (groups: number[], message: string, autoEscape?: boolean): Promise<void>
    sendGroupMsgAsync (groupId: number | number[], message: string, autoEscape?: boolean): Promise<void>
  }
}

const { sendGroupMsgAsync } = CQSender.prototype
CQSender.prototype.sendGroupMsgAsync = async function (this: CQSender, group: number | number[], message: string, autoEscape = false) {
  if (typeof group === 'number') return sendGroupMsgAsync.call(this, group, message, autoEscape)
  const { broadcastInterval = 1000 } = this.app.options
  for (let index = 0; index < group.length; index++) {
    if (index && broadcastInterval) await sleep(broadcastInterval)
    await sendGroupMsgAsync.call(this, group[index], message, autoEscape)
  }
}

Context.prototype.broadcast = async function (this: Context, message, forced) {
  let output = ''
  let capture: RegExpExecArray
  while (capture = imageRE.exec(message)) {
    const [text, _, url] = capture
    output += message.slice(0, capture.index)
    message = message.slice(capture.index + text.length)
    const { data } = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' })
    output += `[CQ:image,file=base64://${Buffer.from(data).toString('base64')}]`
  }
  message = output + message

  const groups = await this.database.getAllGroups(['id', 'assignee', 'flag'])
  const assignMap: Record<number, number[]> = {}
  for (const { id, assignee, flag } of groups) {
    if (!forced && (flag & Group.Flag.noEmit)) continue
    if (assignMap[assignee]) {
      assignMap[assignee].push(id)
    } else {
      assignMap[assignee] = [id]
    }
  }

  await Promise.all(Object.entries(assignMap).map(([id, groups]) => {
    return this.app.bots[+id].sendGroupMsgAsync(groups, message)
  }))
}

const imageRE = /\[CQ:image,file=([^,]+),url=([^\]]+)\]/

export function apply (ctx: Context) {
  ctx.command('broadcast <message...>', '全服广播', { authority: 4 })
    .before(meta => !meta.$app.database)
    .option('-f, --forced', '无视 noEmit 标签进行广播')
    .option('-o, --only', '仅向当前 Bot 负责的群进行广播')
    .action(async ({ options, meta }, message) => {
      if (!message) return meta.$send('请输入要发送的文本。')

      if (options.only) {
        let groups = await ctx.database.getAllGroups(['id', 'flag'], [meta.selfId])
        if (!options.forced) {
          groups = groups.filter(g => !(g.flag & Group.Flag.noEmit))
        }
        return meta.$bot.sendGroupMsgAsync(groups.map(g => g.id), message)
      }

      return ctx.broadcast(message, options.forced)
    })
}
