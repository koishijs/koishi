import { Context, Channel, noop, Session, Logger, Time, Bot, Platform, Database } from 'koishi'
import {} from 'koishi-plugin-teach'
import MysqlDatabase from 'koishi-plugin-mysql'
import Profile from './profile'

const logger = new Logger('status')

type Activity = Record<number, number>
type StatRecord = Record<string, number>

declare module 'koishi-core' {
  interface Channel {
    name: string
    activity: Activity
  }

  interface Session {
    _sendType?: 'command' | 'dialogue'
  }
}

Channel.extend(() => ({
  activity: {},
}))

type DailyField = typeof dailyFields[number]
const dailyFields = [
  'command', 'dialogue', 'botSend', 'botReceive', 'group',
] as const

type HourlyField = typeof hourlyFields[number]
const hourlyFields = [
  'total', 'group', 'private', 'command', 'dialogue',
] as const

type LongtermField = typeof longtermFields[number]
const longtermFields = [
  'message',
] as const

function joinKeys(keys: readonly string[]) {
  return keys.map(key => `\`${key}\``).join(',')
}

interface StatConfig<V> {
  setup: () => V
  create: (value: V) => string
  update: (key: string, value: V) => string
}

abstract class Stat<K extends string, V> {
  public data = {} as Record<K, V>
  private key: string = null

  constructor(private table: string, private fields: readonly K[], private config: StatConfig<V>) {
    this.clear()
  }

  clear() {
    for (const key of this.fields) {
      this.data[key] = this.config.setup()
    }
  }

  update(date: string, sqls: string[]) {
    const updates: string[] = []
    for (const name in this.data) {
      const update = this.config.update(name, this.data[name])
      if (update) updates.push(update)
    }
    if (!updates.length) return

    logger.debug(this.table, this.data)
    if (date === this.key) {
      sqls.push(`UPDATE \`${this.table}\` SET ${updates.join(', ')} WHERE \`time\` = "${date}"`)
    } else {
      this.key = date
      sqls.push(`\
INSERT INTO \`${this.table}\` (\`time\`, ${joinKeys(Object.keys(this.data))}) \
VALUES ("${date}", ${Object.values(this.data).map(this.config.create).join(', ')}) \
ON DUPLICATE KEY UPDATE ${updates.join(', ')}`)
    }
    this.clear()
  }
}

namespace Stat {
  export class Recorded<K extends string> extends Stat<K, StatRecord> {
    constructor(table: string, fields: readonly K[]) {
      super(table, fields, {
        setup: () => ({}),
        create: (value) => {
          return `JSON_OBJECT(${Object.entries(value).map(([key, value]) => `'${key}', ${value}`).join(', ')})`
        },
        update: (name, value) => {
          const entries = Object.entries(value)
          if (!entries.length) return
          return `\`${name}\` = JSON_SET(\`${name}\`, ${entries.map(([key, value]) => {
            return `'$."${key}"', IFNULL(JSON_EXTRACT(\`${name}\`, '$."${key}"'), 0) + ${value}`
          }).join(', ')})`
        },
      })

      Database.extend('koishi-plugin-mysql', ({ tables, Domain }) => {
        tables[table] = Object.assign([
          'primary key (`time`)',
        ], Object.fromEntries(fields.map(key => [key, new Domain.Json('text')])))
      })
    }

    add(field: K, key: string | number) {
      const stat: Record<string, number> = this.data[field]
      stat[key] = (stat[key] || 0) + 1
    }
  }

  export class Numerical<K extends string> extends Stat<K, number> {
    constructor(table: string, fields: readonly K[]) {
      super(table, fields, {
        setup: () => 0,
        create: (value: number) => '' + value,
        update: (key: string, value: number) => {
          if (!value) return
          return `\`${key}\` = \`${key}\` + ${value}`
        },
      })

      Database.extend('koishi-plugin-mysql', ({ tables }) => {
        tables[table] = Object.assign([
          'primary key (`time`)',
        ], Object.fromEntries(fields.map(key => [key, 'int unsigned'])))
      })
    }
  }
}

const daily = new Stat.Recorded('stats_daily', dailyFields)
const hourly = new Stat.Numerical('stats_hourly', hourlyFields)
const longterm = new Stat.Numerical('stats_longterm', longtermFields)
const groups: Record<string, number> = {}

let lastUpdate = new Date()
let updateHour = lastUpdate.getHours()
let updateNumber = Time.getDateNumber()

const REFRESH_INTERVAL = 60000

async function updateStats(db: MysqlDatabase, forced = false) {
  const date = new Date()
  const dateHour = date.getHours()
  if (forced || +date - +lastUpdate > REFRESH_INTERVAL || dateHour !== updateHour) {
    lastUpdate = date
    updateHour = dateHour
    updateNumber = Time.getDateNumber()
    const dateString = date.toLocaleDateString('zh-CN')
    const hourString = `${dateString}-${date.getHours()}:00`
    const sqls: string[] = []
    hourly.update(hourString, sqls)
    daily.update(dateString, sqls)
    longterm.update(dateString, sqls)
    for (const id in groups) {
      sqls.push(`
        UPDATE \`channel\` SET
        \`activity\` = JSON_SET(\`activity\`, '$."${updateNumber}"', IFNULL(JSON_EXTRACT(\`activity\`, '$."${updateNumber}"'), 0) + ${groups[id]})
        WHERE \`id\` = '${id}'
      `)
      delete groups[id]
    }
    if (!sqls.length) return
    logger.debug('stats updated')
    await db.query(sqls)
  }
}

const RECENT_LENGTH = 5

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

type DataPack = [
  Record<DailyField, StatRecord>[],
  ({ time: Date } & Record<HourlyField, number>)[],
  ({ time: Date } & Record<LongtermField, number>)[],
  Pick<Channel, 'id' | 'name' | 'assignee'>[],
]

async function getStatusData(ctx: Context, date: string) {
  const extension = {} as Statistics

  const db = ctx.database.mysql
  const [historyDaily, historyHourly, historyLongterm, groups] = await db.query<DataPack>([
    'SELECT * FROM `stats_daily` WHERE `time` < DATE(?) ORDER BY `time` DESC LIMIT ?',
    'SELECT * FROM `stats_hourly` WHERE `time` < DATE(?) ORDER BY `time` DESC LIMIT ?',
    'SELECT * FROM `stats_longterm` WHERE `time` < DATE(?) ORDER BY `time` DESC',
    'SELECT `id`, `name`, `assignee` FROM `channel`',
  ], [date, RECENT_LENGTH, date, 24 * RECENT_LENGTH, date])

  // history
  extension.history = {}
  historyLongterm.forEach((stat) => {
    extension.history[stat.time.toLocaleDateString('zh-CN')] = stat.message
  })

  // command
  extension.commands = average(historyDaily.map(data => data.command))

  // group
  const groupSet = new Set<string>()
  extension.groups = []
  const groupMap = Object.fromEntries(groups.map(g => [g.id, g]))
  const messageMap = average(historyDaily.map(data => data.group))
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
        last: historyDaily[0].group[id],
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
        last: historyDaily[0].group[key],
        assignee: ctx.bots[assignee].selfId,
      })
    }
  }

  await db.update('channel', updateList)

  extension.hours = new Array(24).fill(0).map((_, index) => {
    return average(historyHourly.filter(s => s.time.getHours() === index))
  })

  // dialogue
  if (db.getDialoguesById) {
    const dialogueMap = average(historyDaily.map(data => data.dialogue))
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

  return { extension, historyDaily }
}

const send = Session.prototype.send
Session.prototype.send = function (...args) {
  if (args[0] && this._sendType) {
    hourly.data[this._sendType] += 1
  }
  return send.apply(this, args)
}

interface CachedData {
  historyDaily: Record<DailyField, StatRecord>[]
  extension: Statistics
}

namespace Statistics {
  let cachedDate: string
  let cachedData: Promise<CachedData>

  export async function patch(ctx: Context, profile: Profile) {
    const date = new Date().toLocaleDateString('zh-CN')
    if (date !== cachedDate) {
      cachedData = getStatusData(ctx, date)
      cachedDate = date
    }
    const { extension, historyDaily } = await cachedData
    Object.assign(profile, extension)

    const botSend = average(historyDaily.map(stat => stat.botSend))
    const botReceive = average(historyDaily.map(stat => stat.botReceive))
    profile.bots.forEach((bot) => {
      const sid = `${bot.platform}:${bot.selfId}`
      bot.recentRate = [botSend[sid] || 0, botReceive[sid] || 0]
    })
  }

  export function apply(ctx: Context) {
    const db = ctx.database.mysql

    function handleSigInt() {
      new Logger('app').info('terminated by SIGINT')
      updateStats(db, true).finally(() => process.exit())
    }

    ctx.on('connect', () => {
      process.on('SIGINT', handleSigInt)
    })

    ctx.before('disconnect', async () => {
      process.off('SIGINT', handleSigInt)
      await updateStats(db, true)
    })

    ctx.before('command', ({ command, session }) => {
      if (command.parent?.name !== 'test') {
        const [name] = command.name.split('.', 1)
        daily.add('command', name)
        updateStats(db)
      }
      session._sendType = 'command'
    })

    ctx.on('dialogue/before-send', ({ session, dialogue }) => {
      session._sendType = 'dialogue'
      daily.add('dialogue', dialogue.id)
      updateStats(db)
    })

    async function updateSendStats(session: Session) {
      hourly.data.total += 1
      hourly.data[session.subtype] += 1
      longterm.data.message += 1
      daily.add('botSend', session.sid)
      if (session.subtype === 'group') {
        daily.add('group', session.gid)
        groups[session.gid] = (groups[session.gid] || 0) + 1
      }
      updateStats(db)
    }

    ctx.on('message', (session) => {
      daily.add('botReceive', session.sid)
    })

    ctx.on('before-send', (session) => {
      updateSendStats(session)
    })
  }
}

export default Statistics
