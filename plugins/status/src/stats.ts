import { Context, Channel, noop, Session, Bot, Time, Dict, Schema } from 'koishi'
import { DataSource } from '@koishijs/plugin-console'
import {} from '@koishijs/cli'

declare module 'koishi' {
  interface Session {
    _sendType?: 'command' | 'dialogue'
  }
}

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Sources {
      stats: StatisticsProvider
    }
  }
}

export interface Synchronizer {
  groups: Dict<number>
  daily: Record<Synchronizer.DailyField, Dict<number>>
  hourly: Record<Synchronizer.HourlyField, number>
  longterm: Record<Synchronizer.LongtermField, number>
  addDaily(field: Synchronizer.DailyField, key: string | number): void
  upload(date: Date): Promise<void>
  download(): Promise<Synchronizer.Data>
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
    extension?: StatisticsProvider.Payload
    groups: Pick<Channel, 'id' | 'name' | 'assignee'>[]
    daily: Record<DailyField, Dict<number>>[]
    hourly: ({ time: Date } & Record<HourlyField, number>)[]
    longterm: ({ time: Date } & Record<LongtermField, number>)[]
  }
}

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

export interface GroupData {
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
    this.app.console.sources.stats.sync.hourly[this._sendType] += 1
  }
  return send.apply(this, args)
}

const customTag = Symbol('custom-send')
Session.prototype.send[customTag] = send

export class StatisticsProvider extends DataSource<StatisticsProvider.Payload> {
  static using = ['database'] as const

  sync: Synchronizer
  lastUpdate = new Date()
  updateHour = this.lastUpdate.getHours()
  callbacks: StatisticsProvider.Extension[] = []
  cachedDate: number
  cachedData: Promise<StatisticsProvider.Payload>
  average = average

  constructor(ctx: Context, private config: StatisticsProvider.Config = {}) {
    super(ctx, 'stats')

    ctx.on('exit', () => this.upload(true))

    this.sync = ctx.database.createSynchronizer()

    ctx.on('disconnect', async () => {
      // rollback to default implementation to prevent infinite call stack
      if (Session.prototype.send[customTag]) {
        Session.prototype.send = Session.prototype.send[customTag]
      }
      await this.upload(true)
    })

    ctx.before('command', ({ command, session }) => {
      if (command.parent?.name !== 'test') {
        const [name] = command.name.split('.', 1)
        this.sync.addDaily('command', name)
        this.upload()
      }
      session._sendType = 'command'
    })

    const updateSendStats = async (session: Session) => {
      this.sync.hourly.total += 1
      this.sync.hourly[session.subtype] += 1
      this.sync.longterm.message += 1
      this.sync.addDaily('botSend', session.sid)
      if (session.subtype === 'group') {
        this.sync.addDaily('group', session.gid)
        this.sync.groups[session.gid] = (this.sync.groups[session.gid] || 0) + 1
      }
      this.upload()
    }

    ctx.on('message', (session) => {
      this.sync.addDaily('botReceive', session.sid)
    })

    ctx.on('before-send', (session) => {
      updateSendStats(session)
    })

    this.extend(this.extendBasic)
    this.extend(this.extendGroup)
  }

  async upload(forced = false) {
    const date = new Date()
    const dateHour = date.getHours()
    if (forced || +date - +this.lastUpdate > this.config.statsInternal || dateHour !== this.updateHour) {
      this.lastUpdate = date
      this.updateHour = dateHour
      await this.sync.upload(date)
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

  private extendGroup: StatisticsProvider.Extension = async (payload, data) => {
    const groupSet = new Set<string>()
    payload.groups = []
    const groupMap = Object.fromEntries(data.groups.map(g => [g.id, g]))
    const messageMap = average(data.daily.map(data => data.group))
    const updateList: Pick<Channel, 'id' | 'platform' | 'name'>[] = []

    async function getGroupInfo(bot: Bot) {
      const { platform } = bot
      const groups = await bot.getGuildList()
      for (const { guildId, guildName: name } of groups) {
        const id = `${platform}:${guildId}`
        if (!messageMap[id] || !groupMap[id] || groupSet.has(id)) continue
        groupSet.add(id)
        const { name: oldName, assignee } = groupMap[id]
        if (name !== oldName) updateList.push({ platform, id: guildId, name })
        payload.groups.push({
          name,
          platform,
          assignee,
          value: messageMap[id],
          last: data.daily[0].group[id] || 0,
        })
      }
    }

    await Promise.all(this.ctx.bots.map(bot => getGroupInfo(bot).catch(noop)))

    for (const key in messageMap) {
      if (!groupSet.has(key) && groupMap[key]) {
        const { name, assignee } = groupMap[key]
        const [platform] = key.split(':') as [never]
        payload.groups.push({
          platform,
          name: name || key,
          value: messageMap[key],
          last: data.daily[0].group[key] || 0,
          assignee: this.ctx.bots.get(`${platform}:${assignee}`)?.selfId || '',
        })
      }
    }

    await this.ctx.database.upsert('channel', updateList)
  }

  async download() {
    const data = await this.sync.download()
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

export namespace StatisticsProvider {
  export interface Payload {
    history: Dict<number>
    commands: Dict<number>
    hours: Dict<number>[]
    groups: GroupData[]
    botSend: Dict<number>
    botReceive: Dict<number>
  }

  export interface Config {
    statsInternal?: number
  }

  export const Config = Schema.object({
    statsInternal: Schema.number().description('统计数据推送的时间间隔。').default(Time.minute * 10),
  })

  export type Extension = (payload: Payload, data: Synchronizer.Data) => Promise<void>
}
