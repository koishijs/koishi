import { Context, Channel, noop, Session, Logger, Bot, Platform, Time } from 'koishi'
import {} from 'koishi-plugin-teach'

export type StatRecord = Record<string, number>

export interface Synchronizer {
  groups: StatRecord
  daily: Record<Synchronizer.DailyField, StatRecord>
  hourly: Record<Synchronizer.HourlyField, number>
  longterm: Record<Synchronizer.LongtermField, number>
  addDaily(field: Synchronizer.DailyField, key: string | number): void
  upload(date: Date): Promise<void>
  download(date: Date): Promise<Synchronizer.Data>
}

export namespace Synchronizer {
  export type DailyField = typeof dailyFields[number]
  export const dailyFields = [
    'command', 'dialogue', 'botSend', 'botReceive', 'group',
  ] as const

  export type HourlyField = typeof hourlyFields[number]
  export const hourlyFields = [
    'total', 'group', 'private', 'command', 'dialogue',
  ] as const

  export type LongtermField = typeof longtermFields[number]
  export const longtermFields = [
    'message',
  ] as const

  export interface Data {
    extension?: Statistics
    groups: Pick<Channel, 'id' | 'name' | 'assignee'>[]
    daily: Record<DailyField, StatRecord>[]
    hourly: ({ time: Date } & Record<HourlyField, number>)[]
    longterm: ({ time: Date } & Record<LongtermField, number>)[]
  }
}

export const RECENT_LENGTH = 5

function average(stats: {}[]) {
  const result: StatRecord = {}
  stats.slice(0, RECENT_LENGTH).forEach((stat) => {
    for (const key in stat) {
      if (typeof stat[key] !== 'number') continue
      result[key] = (result[key] || 0) + stat[key]
    }
  })
  for (const key in result) {
    result[key] = +(result[key] / RECENT_LENGTH).toFixed(1)
  }
  return result
}

interface QuestionData {
  name: string
  value: number
}

interface GroupData {
  name: string
  platform: Platform
  assignee: string
  value: number
  last: number
}

interface Statistics {
  history: StatRecord
  commands: StatRecord
  hours: StatRecord[]
  questions: QuestionData[]
  groups: GroupData[]
  botSend: StatRecord
  botReceive: StatRecord
}

const REFRESH_INTERVAL = 60000

let lastUpdate = new Date()
let updateHour = lastUpdate.getHours()

async function upload(sync: Synchronizer, forced = false) {
  const date = new Date()
  const dateHour = date.getHours()
  if (forced || +date - +lastUpdate > REFRESH_INTERVAL || dateHour !== updateHour) {
    lastUpdate = date
    updateHour = dateHour
    await sync.upload(date)
  }
}

async function download(ctx: Context, date: Date) {
  const data = await ctx.app.synchronizer.download(date)
  const extension = {} as Statistics
  const { daily, hourly, longterm, groups } = data

  // history
  extension.history = {}
  longterm.forEach((stat) => {
    extension.history[stat.time.toLocaleDateString('zh-CN')] = stat.message
  })

  // command & bot
  extension.commands = average(daily.map(data => data.command))
  extension.botSend = average(daily.map(stat => stat.botSend))
  extension.botReceive = average(daily.map(stat => stat.botReceive))

  // group
  const groupSet = new Set<string>()
  extension.groups = []
  const groupMap = Object.fromEntries(groups.map(g => [g.id, g]))
  const messageMap = average(daily.map(data => data.group))
  const updateList: Pick<Channel, 'id' | 'name'>[] = []

  async function getGroupInfo(bot: Bot) {
    const { platform } = bot
    const groups = await bot.getGroupList()
    for (const { groupId, groupName: name } of groups) {
      const id = `${bot.platform}:${groupId}`
      if (!messageMap[id] || groupSet.has(id)) continue
      groupSet.add(id)
      const { name: oldName, assignee } = groupMap[id]
      if (name !== oldName) updateList.push({ id, name })
      extension.groups.push({
        name,
        platform,
        assignee,
        value: messageMap[id],
        last: daily[0].group[id],
      })
    }
  }

  await Promise.all(ctx.bots.map(bot => getGroupInfo(bot).catch(noop)))

  for (const key in messageMap) {
    if (!groupSet.has(key) && groupMap[key]) {
      const { name, assignee } = groupMap[key]
      const [platform] = key.split(':') as [never]
      extension.groups.push({
        platform,
        name: name || key,
        value: messageMap[key],
        last: daily[0].group[key],
        assignee: ctx.bots[`${platform}:${assignee}`].selfId,
      })
    }
  }

  await ctx.database.setChannels(updateList)

  extension.hours = new Array(24).fill(0).map((_, index) => {
    return average(hourly.filter(s => s.time.getHours() === index))
  })

  // dialogue
  if (ctx.database.getDialoguesById) {
    const dialogueMap = average(daily.map(data => data.dialogue))
    const dialogues = await ctx.database.getDialoguesById(Object.keys(dialogueMap) as any, ['id', 'original'])
    const questionMap: Record<string, QuestionData> = {}
    for (const dialogue of dialogues) {
      const { id, original: name } = dialogue
      if (name.includes('[CQ:') || name.startsWith('hook:')) continue
      if (!questionMap[name]) {
        questionMap[name] = {
          name,
          value: dialogueMap[id],
        }
      } else {
        questionMap[name].value += dialogueMap[id]
      }
    }
    extension.questions = Object.values(questionMap)
  }

  return extension
}

const send = Session.prototype.send
Session.prototype.send = function (this: Session, ...args) {
  if (args[0] && this._sendType && this.app.synchronizer) {
    this.app.synchronizer.hourly[this._sendType] += 1
  }
  return send.apply(this, args)
}

const customTag = Symbol('custom-send')
Session.prototype.send[customTag] = send

namespace Statistics {
  let cachedDate: number
  let cachedData: Promise<Statistics>

  export async function get(ctx: Context) {
    const date = new Date()
    const dateNumber = Time.getDateNumber(date, date.getTimezoneOffset())
    if (dateNumber !== cachedDate) {
      cachedData = download(ctx, date)
      cachedDate = dateNumber
    }
    return cachedData
  }

  export function apply(ctx: Context) {
    const sync = ctx.app.synchronizer = new ctx.database.Synchronizer(ctx.database)

    function handleSigInt() {
      new Logger('app').info('terminated by SIGINT')
      upload(sync, true).finally(() => process.exit())
    }

    ctx.on('connect', () => {
      process.on('SIGINT', handleSigInt)
    })

    ctx.before('disconnect', async () => {
      // rollback to default implementation to prevent infinite call stack
      if (Session.prototype.send[customTag]) {
        Session.prototype.send = Session.prototype.send[customTag]
      }
      process.off('SIGINT', handleSigInt)
      await upload(sync, true)
    })

    ctx.before('command', ({ command, session }) => {
      if (command.parent?.name !== 'test') {
        const [name] = command.name.split('.', 1)
        sync.addDaily('command', name)
        upload(sync)
      }
      session._sendType = 'command'
    })

    ctx.on('dialogue/before-send', ({ session, dialogue }) => {
      session._sendType = 'dialogue'
      sync.addDaily('dialogue', dialogue.id)
      upload(sync)
    })

    async function updateSendStats(session: Session) {
      sync.hourly.total += 1
      sync.hourly[session.subtype] += 1
      sync.longterm.message += 1
      sync.addDaily('botSend', session.sid)
      if (session.subtype === 'group') {
        sync.addDaily('group', session.gid)
        sync.groups[session.gid] = (sync.groups[session.gid] || 0) + 1
      }
      upload(sync)
    }

    ctx.on('message', (session) => {
      sync.addDaily('botReceive', session.sid)
    })

    ctx.on('before-send', (session) => {
      updateSendStats(session)
    })
  }
}

export default Statistics
