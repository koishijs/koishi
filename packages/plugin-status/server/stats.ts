import { Context, Channel, noop, Session, Logger, Bot, Platform } from 'koishi'
import {} from 'koishi-plugin-teach'
import { Synchronizer } from './database'
import Profile from './profile'

type StatRecord = Record<string, number>

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

async function download(ctx: Context, date: string) {
  const data = await ctx.app.synchronizer.download(date)
  const extension = data.extension = {} as Statistics
  const { daily, hourly, longterm, groups } = data

  // history
  extension.history = {}
  longterm.forEach((stat) => {
    extension.history[stat.time.toLocaleDateString('zh-CN')] = stat.message
  })

  // command
  extension.commands = average(daily.map(data => data.command))

  // group
  const groupSet = new Set<string>()
  extension.groups = []
  const groupMap = Object.fromEntries(groups.map(g => [g.id, g]))
  const messageMap = average(daily.map(data => data.group))
  const updateList: Pick<Channel, 'id' | 'name'>[] = []

  async function getGroupInfo(bot: Bot) {
    const groups = await bot.getGroupList()
    for (const { groupId, groupName: name } of groups) {
      const id = `${bot.platform}:${groupId}`
      if (!messageMap[id] || groupSet.has(id)) continue
      groupSet.add(id)
      const { name: oldName, assignee } = groupMap[id]
      if (name !== oldName) updateList.push({ id, name })
      extension.groups.push({
        name,
        platform: bot.platform,
        value: messageMap[id],
        last: daily[0].group[id],
        assignee: ctx.bots[assignee].selfId,
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
        assignee: ctx.bots[assignee].selfId,
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

  return data
}

const send = Session.prototype.send
Session.prototype.send = function (this: Session, ...args) {
  if (args[0] && this._sendType && this.app.synchronizer) {
    this.app.synchronizer.hourly[this._sendType] += 1
  }
  return send.apply(this, args)
}

namespace Statistics {
  let cachedDate: string
  let cachedData: Promise<Synchronizer.Data>

  export async function patch(ctx: Context, profile: Profile) {
    const dateString = new Date().toLocaleDateString('zh-CN')
    if (dateString !== cachedDate) {
      cachedData = download(ctx, dateString)
      cachedDate = dateString
    }
    const { extension, daily } = await cachedData
    Object.assign(profile, extension)

    const botSend = average(daily.map(stat => stat.botSend))
    const botReceive = average(daily.map(stat => stat.botReceive))
    profile.bots.forEach((bot) => {
      const sid = `${bot.platform}:${bot.selfId}`
      bot.recentRate = [botSend[sid] || 0, botReceive[sid] || 0]
    })
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
