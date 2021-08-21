import { Database, Logger, Time } from 'koishi-core'
import { RECENT_LENGTH, StatRecord, Synchronizer } from '../payload/stats'
import type MongoDatabase from 'koishi-plugin-mongo'

const logger = new Logger('status')

declare module 'koishi-core' {
  interface Tables {
    'plugin-status': any
  }
}

class MongoSynchronizer implements Synchronizer {
  groups: StatRecord
  daily: any
  hourly: Record<Synchronizer.HourlyField, number>
  longterm: Record<Synchronizer.LongtermField, number>

  constructor(private db: MongoDatabase) {
    this.reset()
  }

  reset() {
    this.hourly = Object.fromEntries(Synchronizer.hourlyFields.map(i => [i, 0])) as any
    this.daily = {}
    this.longterm = Object.fromEntries(Synchronizer.longtermFields.map(i => [i, 0])) as any
    this.groups = {}
  }

  addDaily(field: Synchronizer.DailyField, key: string | number) {
    if (!this.daily[field]) this.daily[field] = {}
    const stat: Record<string, number> = this.daily[field]
    stat[key] = (stat[key] || 0) + 1
  }

  async upload(date: Date): Promise<void> {
    logger.info('Updating status', this.hourly, this.daily, this.longterm, this.groups)
    const coll = this.db.collection('plugin-status')
    const _date = new Date(date)
    _date.setMinutes(0)
    _date.setSeconds(0)
    _date.setMilliseconds(0)
    await coll.updateOne({ type: 'hourly', time: _date }, { $inc: this.hourly }, { upsert: true })
    _date.setHours(0)
    const $inc = {}
    for (const key in this.daily) {
      for (const subkey in this.daily[key]) {
        $inc[`${key}.${subkey}`] = this.daily[key][subkey]
      }
    }
    if (Object.keys($inc).length) await coll.updateOne({ type: 'daily', time: _date }, { $inc }, { upsert: true })
    await coll.updateOne({ type: 'longterm', time: _date }, { $inc: this.longterm }, { upsert: true })
    for (const id in this.groups) {
      const [type, pid] = id.split(':') as any
      await this.db.channel.updateOne({ type, pid }, { $inc: { ['activity.' + Time.getDateNumber(date)]: this.groups[id] } } as any)
    }
    this.reset()
    logger.debug('stats updated')
  }

  async download() {
    const time = { $lt: new Date() }
    const coll = this.db.collection('plugin-status')
    const hourly = await coll.find({ type: 'hourly', time }).sort({ time: -1 }).limit(24 * RECENT_LENGTH).toArray()
    const daily = await coll.find({ type: 'daily', time }).sort({ time: -1 }).limit(RECENT_LENGTH).toArray()
    const longterm = await coll.find({ type: 'longterm', time }).sort({ time: -1 }).toArray()
    const groups = await this.db.channel.find({}).project({ type: 1, pid: 1, name: 1, assignee: 1 })
      .map(data => ({ ...data, id: `${data.type}:${data.pid}` })).toArray()
    return { daily, hourly, longterm, groups }
  }
}

Database.extend('koishi-plugin-mongo', {
  async getStats() {
    const $gt = new Date(new Date().getTime() - 1000 * 3600 * 24)
    const [allGroups, activeGroups, allUsers, activeUsers, { storageSize }] = await Promise.all([
      this.channel.countDocuments(),
      this.channel.find({ assignee: { $ne: null } }).count(),
      this.user.countDocuments(),
      this.user.find({ lastCall: { $gt } }).count(),
      this.mongo.db.stats(),
    ])
    return { allGroups, activeGroups, allUsers, activeUsers, storageSize }
  },

  createSynchronizer() {
    return new MongoSynchronizer(this)
  },
})
