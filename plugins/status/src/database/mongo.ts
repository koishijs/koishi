import { Database, Logger, Time, Dict } from 'koishi'
import { RECENT_LENGTH, Synchronizer } from '../stats'
import type MongoDatabase from '@koishijs/plugin-database-mongo'

const logger = new Logger('status')

declare module '@koishijs/plugin-database-mongo' {
  interface Tables {
    'plugin-status': any
  }
}

class MongoSynchronizer implements Synchronizer {
  groups: Dict<number>
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
    logger.debug(this.hourly, this.daily, this.longterm, this.groups)
    const coll = this.db.db.collection('plugin-status')
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
      await this.db.db.collection('channel').updateOne({ id }, { $inc: { ['activity.' + Time.getDateNumber(date)]: this.groups[id] } } as any)
    }
    this.reset()
    logger.debug('stats updated')
  }

  async download() {
    const time = { $lt: new Date() }
    const coll = this.db.db.collection('plugin-status')
    const hourly = await coll.find({ type: 'hourly', time }).sort({ time: -1 }).limit(24 * RECENT_LENGTH).toArray()
    const daily = await coll.find({ type: 'daily', time }).sort({ time: -1 }).limit(RECENT_LENGTH).toArray()
    const longterm = await coll.find({ type: 'longterm', time }).sort({ time: -1 }).toArray()
    const groups = await this.db.db.collection('channel').find({}).project({ type: 1, id: 1, name: 1, assignee: 1 }).toArray()
    return { daily, hourly, longterm, groups }
  }
}

Database.extend('database-mongo', {
  async stats() {
    const getTableStats = async () => {
      const cols = await this.db.collections()
      const entries = await Promise.all(cols.map(async (col) => {
        const { count, size } = await col.stats()
        return [col.collectionName, { count, size }] as const
      }))
      return Object.fromEntries(entries)
    }

    const $gt = new Date(new Date().getTime() - 1000 * 3600 * 24)
    const [allGroups, activeGroups, allUsers, activeUsers, tables] = await Promise.all([
      this.db.collection('channel').countDocuments(),
      this.db.collection('channel').find({ assignee: { $ne: null } }).count(),
      this.db.collection('user').countDocuments(),
      this.db.collection('user').find({ lastCall: { $gt } }).count(),
      getTableStats(),
    ])
    return { allGroups, activeGroups, allUsers, activeUsers, tables }
  },

  createSynchronizer() {
    return new MongoSynchronizer(this)
  },
})
