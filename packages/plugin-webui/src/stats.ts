import { Context, Channel, noop, Session, Bot, Platform, Time } from 'koishi-core'
import { DataSource } from './data'
import {} from 'koishi'

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
    extension?: Statistics.Payload
    groups: Pick<Channel, 'id' | 'name' | 'assignee'>[]
    daily: Record<DailyField, StatRecord>[]
    hourly: ({ time: Date } & Record<HourlyField, number>)[]
    longterm: ({ time: Date } & Record<LongtermField, number>)[]
  }
}

export const RECENT_LENGTH = 5

export function average(stats: {}[]) {
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

interface GroupData {
  name: string
  platform: Platform
  assignee: string
  value: number
  last: number
}

const send = Session.prototype.send
Session.prototype.send = function (this: Session, ...args) {
  if (args[0] && this._sendType && this.app.webui) {
    this.app.webui.sources.stats.sync.hourly[this._sendType] += 1
  }
  return send.apply(this, args)
}

const customTag = Symbol('custom-send')
Session.prototype.send[customTag] = send

export class Statistics implements DataSource<Statistics.Payload> {
  sync: Synchronizer
  lastUpdate = new Date()
  updateHour = this.lastUpdate.getHours()
  callbacks: Statistics.Extension[] = []
  cachedDate: number
  cachedData: Promise<Statistics.Payload>
  average = average

  constructor(private ctx: Context, public config: Statistics.Config = {}) {
    ctx.on('exit', () => this.upload(true))

    ctx.on('delegate/database', () => {
      this.sync = ctx.database.createSynchronizer()
    })

    ctx.before('disconnect', async () => {
      // rollback to default implementation to prevent infinite call stack
      if (Session.prototype.send[customTag]) {
        Session.prototype.send = Session.prototype.send[customTag]
      }
      await this.upload(true)
    })

    ctx = ctx.select('database')

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
      await this.sync?.upload(date)
    }
  }

  extend(callback: Statistics.Extension) {
    this.callbacks.push(callback)
  }

  private extendBasic: Statistics.Extension = async (payload, data) => {
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

  private extendGroup: Statistics.Extension = async (payload, data) => {
    const groupSet = new Set<string>()
    payload.groups = []
    const groupMap = Object.fromEntries(data.groups.map(g => [g.id, g]))
    const messageMap = average(data.daily.map(data => data.group))
    const updateList: Pick<Channel, 'id' | 'name'>[] = []

    async function getGroupInfo(bot: Bot) {
      const { platform } = bot
      const groups = await bot.getGroupList()
      for (const { groupId, groupName: name } of groups) {
        const id = `${bot.platform}:${groupId}`
        if (!messageMap[id] || !groupMap[id] || groupSet.has(id)) continue
        groupSet.add(id)
        const { name: oldName, assignee } = groupMap[id]
        if (name !== oldName) updateList.push({ id, name })
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
          assignee: this.ctx.bots[`${platform}:${assignee}`]?.selfId || '',
        })
      }
    }

    await this.ctx.database.update('channel', updateList)
  }

  async download(date: Date) {
    const data = await this.sync.download(date)
    const payload = {} as Statistics.Payload
    await Promise.all(this.callbacks.map(cb => cb(payload, data)))
    return payload
  }

  async get() {
    if (!this.sync) return
    const date = new Date()
    const dateNumber = Time.getDateNumber(date, date.getTimezoneOffset())
    if (dateNumber !== this.cachedDate) {
      this.cachedData = this.download(date)
      this.cachedDate = dateNumber
    }
    return this.cachedData
  }
}

export namespace Statistics {
  export interface Payload {
    history: StatRecord
    commands: StatRecord
    hours: StatRecord[]
    groups: GroupData[]
    botSend: StatRecord
    botReceive: StatRecord
  }

  export interface Config {
    statsInternal?: number
  }

  export type Extension = (payload: Payload, data: Synchronizer.Data) => Promise<void>
}
