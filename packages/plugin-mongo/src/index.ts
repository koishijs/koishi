import MongoDatabase, { Config } from './database'
import { User, Database, extendDatabase, Context } from 'koishi-core'

export * from './database'
export default MongoDatabase

declare module 'koishi-core/dist/database' {
  interface Database extends MongoDatabase { }
}

function projection(keys: readonly string[]) {
  const d = {}
  for (const key of keys) d[key] = 1
  return d
}

function escapeKey<T extends Partial<User>>(doc: T) {
  const data: T = { ...doc }
  delete data.timers
  delete data.usage
  if (doc.timers) {
    data.timers = {}
    for (const key in doc.timers) {
      if (key === '$date') data.timers._date = doc.timers.$date
      else data.timers[key.replace(/\./gmi, '_')] = doc.timers[key]
    }
  }
  if (doc.usage) {
    data.usage = {}
    for (const key in doc.usage) {
      if (key === '$date') data.usage._date = doc.usage.$date
      else data.usage[key.replace(/\./gmi, '_')] = doc.usage[key]
    }
  }
  return data
}

function unescapeKey<T extends Partial<User>>(data: T) {
  if (data.timers) {
    if (data.timers._date) {
      data.timers.$date = data.timers._date
      delete data.timers._date
    }
    for (const key in data.timers) {
      if (key.includes('_')) {
        data.timers[key.replace(/_/gmi, '.')] = data.timers[key]
        delete data.timers[key]
      }
    }
  }
  if (data.usage) {
    if (data.usage._date) {
      data.usage.$date = data.usage._date
      delete data.usage._date
    }
    for (const key in data.usage) {
      if (key.includes('_')) {
        data.usage[key.replace(/_/gmi, '.')] = data.usage[key]
        delete data.usage[key]
      }
    }
  }
  return data
}

extendDatabase(MongoDatabase, {
  async getUser(type, id, _fields) {
    const fields = _fields || User.fields
    if (fields && !fields.length) return { [type]: id } as any
    if (Array.isArray(id)) {
      const users = await this.user.find({ [type]: { $in: id } }).project(projection(fields)).toArray()
      return users.map(unescapeKey)
    }
    const [data] = await this.user.find({ [type]: id }).project(projection(fields)).toArray()
    return data && { ...unescapeKey(data), [type]: id }
  },

  async setUser(type, id, data) {
    if (data === null) await this.user.deleteOne({ [type]: id })
    else await this.user.updateOne({ [type]: id }, { $set: escapeKey(data) }, { upsert: true })
  },

  async getChannel(type, pid, fields) {
    if (Array.isArray(pid)) {
      if (fields && !fields.length) return pid.map(id => ({ id: `${type}:${id}` } as any))
      const channels = await this.channel.find({ _id: { $in: pid.map(id => `${type}:${id}`) } }).project(projection(fields)).toArray()
      return channels.map(channel => ({ ...channel, id: `${channel.type}:${channel.pid}` }))
    }
    if (fields && !fields.length) return { id: `${type}:${pid}` } as any
    const [data] = await this.channel.find({ type, pid }).project(projection(fields)).toArray()
    return data && { ...data, id: `${type}:${pid}` }
  },

  async getChannelList(fields, type, assignees) {
    const idMap: (readonly [string, readonly string[]])[] = assignees ? [[type, assignees]]
      : type ? [[type, this.app.servers[type].bots.map(bot => bot.selfId)]]
        : Object.entries(this.app.servers).map(([type, { bots }]) => [type, bots.map(bot => bot.selfId)])
    const channels = await this.channel.find({ $or: idMap.map(([type, ids]) => ({ type, pid: { $in: ids } })) }).project(projection(fields)).toArray()
    return channels.map(channel => ({ ...channel, id: `${channel.type}:${channel.pid}` }))
  },

  async setChannel(type, pid, data) {
    if (data === null) return this.channel.deleteOne({ type, pid }) as any
    await this.user.updateOne({ type, pid }, { $set: data }, { upsert: true })
  },
})

export const name = 'mongo'

export function apply(ctx: Context, config: Config) {
  const db = new MongoDatabase(ctx.app, { host: 'localhost', port: 27017, name: 'koishi', protocol: 'mongodb', ...config })
  ctx.database = db as Database
  ctx.on('before-connect', () => db.start())
  ctx.on('before-disconnect', () => db.stop())
}
