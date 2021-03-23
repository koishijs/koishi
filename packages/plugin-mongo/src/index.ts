import MongoDatabase, { Config } from './database'
import { User, Database, Context, Channel, Random, pick, omit } from 'koishi-core'

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

function projection(keys: Iterable<string>) {
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

Database.extend(MongoDatabase, ({ tables }) => {
  tables.user = { primary: 'id' }
  tables.channel = { primary: 'id' }
})

Database.extend(MongoDatabase, {
  async get(table, key, value, fields) {
    if (!value.length) return []
    const { primary } = this.getConfig(table)
    if (key === primary) key = '_id'
    let cursor = this.db.collection(table).find({ [key]: { $in: value } })
    if (fields) cursor = cursor.project(projection(fields))
    const data = await cursor.toArray()
    for (const item of data) item[primary] = item._id
    return data
  },

  async create(table, data: any) {
    const { primary, type } = this.getConfig(table)
    const copy = { ...data }
    if (copy[primary]) {
      copy['_id'] = copy[primary]
      delete copy[primary]
    } else if (type === 'incremental') {
      const [latest] = await this.db.collection(table).find().sort('_id', -1).limit(1).toArray()
      copy['_id'] = data[primary] = latest ? latest._id + 1 : 1
    }
    await this.db.collection(table).insertOne(copy)
    return data
  },

  async remove(table, key, value) {
    if (!value.length) return
    const { primary } = this.getConfig(table)
    if (key === primary) key = '_id'
    await this.db.collection(table).deleteMany({ [key]: { $in: value } })
  },

  async update(table, data: any[], key: string) {
    if (!data.length) return
    const { primary } = this.getConfig(table)
    if (!key || key === primary) key = '_id'
    const bulk = this.db.collection(table).initializeUnorderedBulkOp()
    for (const item of data) {
      bulk.find({ [key]: data[primary] }).updateOne({ $set: omit(item, [primary]) })
    }
    await bulk.execute()
  },

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
    const project = { pid: 1, type: 1, ...projection(fields) }
    const channels = await this.channel.find({
      $or: Object.entries(assignMap).map<any>(([type, ids]) => ({ type, assignee: { $in: ids } })),
    }).project(project).toArray()
    return channels.map(channel => ({ ...pick(Channel.create(channel.type, channel.pid), fields), ...channel, id: `${channel.type}:${channel.pid}` }))
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
