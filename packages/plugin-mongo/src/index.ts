import MongoDatabase, { Config } from './database'
import { User, Database, Context, Channel, Random, pick } from 'koishi-core'

export * from './database'
export default MongoDatabase

declare module 'koishi-core' {
  interface Database {
    mongo: MongoDatabase
  }

  namespace Database {
    interface Statics {
      'koishi-plugin-mongo': typeof MongoDatabase
    }
  }

  interface Channel {
    type: Platform
    pid: string
  }
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

Database.extend(MongoDatabase, {
  async getUser(type, id, fields = User.fields) {
    if (fields && !fields.length) return { [type]: id } as any
    if (Array.isArray(id)) {
      const users = await this.user.find({ [type]: { $in: id } }).project(projection(fields)).toArray()
      return users.map(data => (data && {
        ...pick(User.create(type, data[type]), fields), ...unescapeKey(data),
      }))
    }
    const [data] = await this.user.find({ [type]: id }).project(projection(fields)).toArray()
    const udoc = User.create(type, id as any)
    return data && { ...pick(udoc, fields), ...unescapeKey(data), [type]: id }
  },

  async setUser(type, id, data) {
    await this.user.updateOne(
      { [type]: id },
      { $set: escapeKey(data), $setOnInsert: { id: Random.uuid() } },
      { upsert: true },
    )
  },

  async createUser(type, id, data) {
    await this.setUser(type, id, data)
  },

  async removeUser(type, id) {
    await this.user.deleteOne({ [type]: id })
  },

  async getChannel(type, pid, fields = Channel.fields) {
    if (Array.isArray(pid)) {
      if (fields && !fields.length) return pid.map(id => ({ id: `${type}:${id}` }))
      const channels = await this.channel.find({ _id: { $in: pid.map(id => `${type}:${id}`) } })
        .project(projection(fields)).toArray()
      return channels.map(channel => ({ ...pick(Channel.create(type, channel.pid), fields), ...channel, id: `${type}:${channel.pid}` }))
    }
    if (fields && !fields.length) return { id: `${type}:${pid}` }
    const [data] = await this.channel.find({ type, pid: pid as string }).project(projection(fields)).toArray()
    return data && { ...pick(Channel.create(type, pid as string), fields), ...data, id: `${type}:${pid}` }
  },

  async getAssignedChannels(fields, assignMap = this.app.getSelfIds()) {
    const channels = await this.channel.find({
      $or: Object.entries(assignMap).map<any>(([type, ids]) => ({ type, assignee: { $in: ids } })),
    }).project(projection(fields)).toArray()
    return channels.map(channel => ({ ...pick(Channel.create(channel.type, channel.id), fields), ...channel, id: `${channel.id}` }))
  },

  async removeChannel(type, pid) {
    await this.channel.deleteOne({ type, pid })
  },

  async setChannel(type, pid, data) {
    await this.channel.updateOne({ type, pid }, { $set: data }, { upsert: true })
  },

  async createChannel(type, pid, data) {
    await this.setChannel(type, pid, data)
  },
})

export const name = 'mongo'

export function apply(ctx: Context, config: Config) {
  const db = new MongoDatabase(ctx.app, { host: 'localhost', port: 27017, name: 'koishi', protocol: 'mongodb', ...config })
  ctx.database = db as any
  ctx.before('connect', () => db.start())
  ctx.before('disconnect', () => db.stop())
}
