import { Context, Group, Bot } from 'koishi-core'
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

declare module 'koishi-core/dist/server' {
  interface Bot {
    sendGroupMsg (groups: number[], message: string, autoEscape?: boolean): Promise<void>
    sendGroupMsg (groupId: number | number[], message: string, autoEscape?: boolean): Promise<void | number>
  }
}

const { sendGroupMsg } = Bot.prototype
Bot.prototype.sendGroupMsg = async function (this: Bot, group: number | number[], message: string, autoEscape = false) {
  if (typeof group === 'number') {
    return sendGroupMsg.call(this, group, message, autoEscape) as any
  }
  const { broadcastInterval = 1000 } = this.app.options
  for (let index = 0; index < group.length; index++) {
    if (index && broadcastInterval) await sleep(broadcastInterval)
    await sendGroupMsg.call(this, group[index], message, autoEscape)
  }
}

Context.prototype.broadcast = async function (this: Context, message, forced) {
  let output = ''
  let capture: RegExpExecArray
  // eslint-disable-next-line no-cond-assign
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
    return this.app.bots[+id].sendGroupMsg(groups, message)
  }))
}

const imageRE = /\[CQ:image,file=([^,]+),url=([^\]]+)\]/

export function apply(ctx: Context) {
  ctx.command('broadcast <message...>', '全服广播', { authority: 4 })
    .before(session => !session.$app.database)
    .option('forced', '-f  无视 noEmit 标签进行广播')
    .option('only', '-o  仅向当前 Bot 负责的群进行广播')
    .action(async ({ options, session }, message) => {
      if (!message) return '请输入要发送的文本。'
      if (!options.only) return ctx.broadcast(message, options.forced)

      let groups = await ctx.database.getAllGroups(['id', 'flag'], [session.selfId])
      if (!options.forced) {
        groups = groups.filter(g => !(g.flag & Group.Flag.noEmit))
      }
      await session.$bot.sendGroupMsg(groups.map(g => g.id), message)
    })
}
