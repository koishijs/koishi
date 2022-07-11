import { $, Bot, Channel, Context, Dict, Logger, Schema, Session, Time, valueMap } from 'koishi'
import { DataService } from '@koishijs/plugin-console'
import {} from '@koishijs/cli'

declare module 'koishi' {
  interface Session {
    _sendType?: 'command' | 'dialogue'
  }

  interface Tables {
    stats_daily: Record<StatisticsProvider.DailyField, Dict<number>> & { time: Date }
    stats_hourly: Record<StatisticsProvider.HourlyField, number> & { time: Date }
    stats_longterm: Record<StatisticsProvider.LongtermField, number> & { time: Date }
  }
}

const logger = new Logger('stats')

export const RECENT_LENGTH = 5

export function average(stats: {}[]) {
  const result: Dict<number> = {}
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

export interface GuildData {
  name: string
  platform: string
  assignee: string
  memberCount?: number
  value: number
  last: number
}

const send = Session.prototype.send
Session.prototype.send = function (this: Session, ...args) {
  if (args[0] && this._sendType && this.app.console) {
    this.app.console.stats.hourly[this._sendType] += 1
  }
  return send.apply(this, args)
}

const customTag = Symbol('custom-send')
Session.prototype.send[customTag] = send

class StatisticsProvider extends DataService<StatisticsProvider.Payload> {
  static using = ['database'] as const

  lastUpdate = new Date()
  updateHour = this.lastUpdate.getHours()
  callbacks: StatisticsProvider.Extension[] = []
  cachedDate: number
  cachedData: Promise<StatisticsProvider.Payload>
  average = average

  guilds: Dict<Dict<number>>
  daily: Record<StatisticsProvider.DailyField, Dict<number>>
  hourly: Record<StatisticsProvider.HourlyField, number>
  longterm: Record<StatisticsProvider.LongtermField, number>

  constructor(ctx: Context, private config: StatisticsProvider.Config = {}) {
    super(ctx, 'stats')

    this.clear()

    ctx.model.extend('channel', {
      name: 'string(50)',
      activity: 'json',
    })

    ctx.model.extend('stats_daily', {
      time: 'date',
      ...Object.fromEntries(StatisticsProvider.dailyFields.map((key) => [key, 'json'])),
    }, { primary: 'time' })

    ctx.model.extend('stats_hourly', {
      time: 'timestamp',
      ...Object.fromEntries(StatisticsProvider.hourlyFields.map((key) => [key, { type: 'integer', initial: 0 }])),
    }, { primary: 'time' })

    ctx.model.extend('stats_longterm', {
      time: 'date',
      ...Object.fromEntries(StatisticsProvider.longtermFields.map((key) => [key, { type: 'integer', initial: 0 }])),
    }, { primary: 'time' })

    ctx.on('exit', () => this.upload(true))

    ctx.on('dispose', async () => {
      // rollback to default implementation to prevent infinite call stack
      if (Session.prototype.send[customTag]) {
        Session.prototype.send = Session.prototype.send[customTag]
      }
      await this.upload(true)
    })

    ctx.before('command/execute', ({ command, session }) => {
      if (command.parent?.name !== 'test') {
        const [name] = command.name.split('.', 1)
        this.addDaily('command', name)
        this.upload()
      }
      session._sendType = 'command'
    })

    const updateSendStats = async (session: Session) => {
      this.hourly.total += 1
      this.hourly[session.subtype] += 1
      this.longterm.message += 1
      this.addDaily('botSend', session.sid)
      if (session.subtype === 'group') {
        this.addDaily('group', session.gid)
        const record = this.guilds[session.platform] ||= {}
        record[session.guildId] = (record[session.guildId] || 0) + 1
      }
      this.upload()
    }

    ctx.on('message', (session) => {
      this.addDaily('botReceive', session.sid)
    })

    ctx.on('before-send', (session) => {
      updateSendStats(session)
    })

    this.extend(this.extendBasic)
    this.extend(this.extendGuilds)
  }

  private clear() {
    this.daily = Object.fromEntries(StatisticsProvider.dailyFields.map(i => [i, {}])) as any
    this.hourly = Object.fromEntries(StatisticsProvider.hourlyFields.map(i => [i, 0])) as any
    this.longterm = Object.fromEntries(StatisticsProvider.longtermFields.map(i => [i, 0])) as any
    this.guilds = {}
  }

  addDaily(field: StatisticsProvider.DailyField, key: string | number) {
    const stat: Record<string, number> = this.daily[field] ||= {}
    stat[key] = (stat[key] || 0) + 1
  }

  private async _uploadDaily(date: Date) {
    if (!Object.values(this.daily).some(data => Object.keys(data).length)) return
    const time = new Date(date)
    time.setHours(0, 0, 0, 0)
    await this.ctx.database.upsert('stats_daily', row => [{
      time,
      ...Object.fromEntries(Object.entries(this.daily).flatMap(([type, record]) => {
        return Object.entries(record).map(([key, value]) => {
          return [`${type}.${key}`, $.add($.ifNull(row[type][key], 0), value)]
        })
      })),
    }])
  }

  private async _uploadHourly(date: Date) {
    if (!Object.values(this.hourly).some(value => value)) return
    const time = new Date(date)
    time.setMinutes(0, 0, 0)
    await this.ctx.database.upsert('stats_hourly', row => [{
      time,
      ...valueMap(this.hourly, (value, key) => $.add(row[key], value)),
    }])
  }

  private async _uploadLongterm(date: Date) {
    if (!Object.values(this.longterm).some(value => value)) return
    const time = new Date(date)
    time.setHours(0, 0, 0, 0)
    await this.ctx.database.upsert('stats_longterm', row => [{
      time,
      ...valueMap(this.longterm, (value, key) => $.add(row[key], value)),
    }])
  }

  private async _uploadGuilds(date: Date) {
    if (!Object.values(this.guilds).some(data => Object.keys(data).length)) return
    const key = 'activity.' + Time.getDateNumber(date)
    await this.ctx.database.upsert('channel', (row) => {
      return Object.entries(this.guilds).flatMap(([platform, record]) => {
        return Object.entries(record).map(([id, value]) => ({
          id,
          platform,
          [key]: $.add($.ifNull(row[key], 0), value),
        }))
      })
    })
  }

  async upload(forced = false) {
    const date = new Date()
    const dateHour = date.getHours()
    if (forced || +date - +this.lastUpdate > this.config.statsInternal || dateHour !== this.updateHour) {
      this.lastUpdate = date
      this.updateHour = dateHour
      await Promise.all([
        this._uploadDaily(date),
        this._uploadHourly(date),
        this._uploadLongterm(date),
        this._uploadGuilds(date),
      ])
      this.clear()
      logger.debug('stats updated')
    }
  }

  extend(callback: StatisticsProvider.Extension) {
    this.callbacks.push(callback)
  }

  private extendBasic: StatisticsProvider.Extension = async (payload, data) => {
    // history
    payload.history = {}
    data.longterm.forEach((stat) => {
      payload.history[stat.time.toLocaleDateString('zh-CN')] = stat.message
    })

    // command & bot
    payload.commands = average(data.daily.map(data => data.command))
    payload.botSend = average(data.daily.map(stat => stat.botSend))
    payload.botReceive = average(data.daily.map(stat => stat.botReceive))

    // hours
    payload.hours = new Array(24).fill(0).map((_, index) => {
      return average(data.hourly.filter(s => s.time.getHours() === index))
    })
  }

  private extendGuilds: StatisticsProvider.Extension = async (payload, data) => {
    const groupSet = new Set<string>()
    payload.guilds = []
    const groupMap = Object.fromEntries(data.guilds.map(g => [`${g.platform}:${g.id}`, g]))
    const messageMap = average(data.daily.map(data => data.group))
    const updateList: Pick<Channel, 'id' | 'platform' | 'name'>[] = []

    async function getGuildInfo(bot: Bot) {
      const { platform } = bot
      const guilds = await bot.getGuildList()
      for (const { guildId, guildName: name } of guilds) {
        const id = `${platform}:${guildId}`
        if (!messageMap[id] || !groupMap[id] || groupSet.has(id)) continue
        groupSet.add(id)
        const { name: oldName, assignee } = groupMap[id]
        if (name !== oldName) updateList.push({ platform, id: guildId, name })
        payload.guilds.push({
          name,
          platform,
          assignee,
          value: messageMap[id],
          last: data.daily[0].group[id] || 0,
        })
      }
    }

    await Promise.all(this.ctx.bots.map(async (bot) => {
      if (bot.status !== 'online') return
      await getGuildInfo(bot).catch(logger.warn)
    }))

    for (const key in messageMap) {
      if (!groupSet.has(key) && groupMap[key]) {
        const { name, assignee } = groupMap[key]
        const [platform] = key.split(':') as [never]
        payload.guilds.push({
          platform,
          name: name || key,
          value: messageMap[key],
          last: data.daily[0].group[key] || 0,
          assignee: this.ctx.bots[`${platform}:${assignee}`]?.selfId || '',
        })
      }
    }

    await this.ctx.database.upsert('channel', updateList)
  }

  async download() {
    const time = { $lt: new Date() }, sort = { time: 'desc' as const }
    const [daily, hourly, longterm, guilds] = await Promise.all([
      this.ctx.database.get('stats_daily', { time }, { sort, limit: RECENT_LENGTH }),
      this.ctx.database.get('stats_hourly', { time }, { sort, limit: 24 * RECENT_LENGTH }),
      this.ctx.database.get('stats_longterm', { time }, { sort }),
      this.ctx.database.get('channel', row => $.eq(row.id, row.guildId), ['platform', 'id', 'name', 'assignee']),
    ])
    const data = { daily, hourly, longterm, guilds }
    const payload = {} as StatisticsProvider.Payload
    await Promise.all(this.callbacks.map(cb => cb(payload, data)))
    return payload
  }

  async get() {
    const date = new Date()
    const dateNumber = Time.getDateNumber(date, date.getTimezoneOffset())
    if (dateNumber !== this.cachedDate) {
      this.cachedData = this.download()
      this.cachedDate = dateNumber
    }
    return this.cachedData
  }
}

namespace StatisticsProvider {
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
    extension?: StatisticsProvider.Payload
    guilds: Pick<Channel, 'id' | 'platform' | 'name' | 'assignee'>[]
    daily: Record<DailyField, Dict<number>>[]
    hourly: ({ time: Date } & Record<HourlyField, number>)[]
    longterm: ({ time: Date } & Record<LongtermField, number>)[]
  }

  export interface Payload {
    history: Dict<number>
    commands: Dict<number>
    hours: Dict<number>[]
    guilds: GuildData[]
    botSend: Dict<number>
    botReceive: Dict<number>
  }

  export interface Config {
    statsInternal?: number
  }

  export const Config: Schema<Config> = Schema.object({
    statsInternal: Schema.natural().role('ms').description('统计数据推送的时间间隔。').default(Time.minute * 10),
  })

  export type Extension = (payload: Payload, data: StatisticsProvider.Data) => Promise<void>
}

export default StatisticsProvider
