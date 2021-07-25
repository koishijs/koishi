import MongoDatabase, { Config } from './database'
import { User, Tables, Database, Context, Channel, Random, pick, omit, TableType, Query } from 'koishi-core'

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

function createFilter<T extends TableType>(name: T, _query: Query<T>) {
  function transformQuery(query: Query.Expr) {
    const filter = {}
    for (const key in query) {
      const value = query[key]
      if (key === '$and' || key === '$or') {
        filter[key] = value.map(transformQuery)
      } else if (key === '$not') {
        filter[key] = transformQuery(value)
      } else if (typeof value === 'string' || typeof value === 'number') {
        filter[key] = { $eq: value }
      } else if (Array.isArray(value)) {
        if (!value.length) return
        filter[key] = { $in: value }
      } else {
        filter[key] = value
      }
    }
    return filter
  }

  const filter = transformQuery(Query.resolve(name, _query))
  const { primary } = Tables.config[name]
  if (filter[primary]) {
    filter['_id'] = filter[primary]
    delete filter[primary]
  }
  return filter
}

Database.extend(MongoDatabase, {
  async get(name, query, fields) {
    const filter = createFilter(name, query)
    if (!filter) return []
    let cursor = this.db.collection(name).find(filter)
    if (fields) cursor = cursor.project(projection(fields))
    const data = await cursor.toArray()
    const { primary } = Tables.config[name]
    for (const item of data) item[primary] = item._id
    return data
  },

  async remove(name, query) {
    const filter = createFilter(name, query)
    if (!filter) return
    await this.db.collection(name).deleteMany(filter)
  },

  async create(name, data: any) {
    const { primary, type } = Tables.config[name]
    const copy = { ...data }
    if (copy[primary]) {
      copy['_id'] = copy[primary]
      delete copy[primary]
    } else if (type === 'incremental') {
      const [latest] = await this.db.collection(name).find().sort('_id', -1).limit(1).toArray()
      copy['_id'] = data[primary] = latest ? latest._id + 1 : 1
    }
    await this.db.collection(name).insertOne(copy)
    return data
  },

  async update(name, data: any[], key: string) {
    if (!data.length) return
    const { primary } = Tables.config[name]
    if (!key || key === primary) key = '_id'
    const bulk = this.db.collection(name).initializeUnorderedBulkOp()
    for (const item of data) {
      bulk.find({ [key]: item[primary] }).updateOne({ $set: omit(item, [primary]) })
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
    const [udoc] = await this.user.find({}).sort({ id: -1 }).limit(1).project({ id: 1 }).toArray()
    const uid = (+udoc?.id || 0) + 1
    await this.user.updateOne(
      { [type]: id },
      { $set: escapeKey(data), $setOnInsert: { id: uid.toString() } },
      { upsert: true },
    )
  },

  async createUser(type, id, data) {
    await this.setUser(type, id, data)
  },

  async getChannel(type, pid, fields = Channel.fields) {
    if (Array.isArray(pid)) {
      if (fields && !fields.length) return pid.map(id => ({ id: `${type}:${id}` }))
      const channels = await this.channel.find({ _id: { $in: pid.map(id => `${type}:${id}`) } })
        .project(projection(fields)).toArray()
      return channels.map(channel => ({ ...pick(Channel.create(type, channel.pid), fields), ...channel, _id: `${type}:${channel.pid}`, id: `${type}:${channel.pid}` }))
    }
    if (fields && !fields.length) return { id: `${type}:${pid}` }
    const [data] = await this.channel.find({ type, pid: pid as string }).project(projection(fields)).toArray()
    return data && { ...pick(Channel.create(type, pid as string), fields), ...data, _id: `${type}:${pid}`, id: `${type}:${pid}` }
  },

  async getAssignedChannels(fields, assignMap = this.app.getSelfIds()) {
    const project = { pid: 1, type: 1, ...projection(fields) }
    const channels = await this.channel.find({
      $or: Object.entries(assignMap).map<any>(([type, ids]) => ({ type, assignee: { $in: ids } })),
    }).project(project).toArray()
    return channels.map(channel => ({ ...pick(Channel.create(channel.type, channel.pid), fields), ...channel, _id: `${channel.type}:${channel.pid}`, id: `${channel.type}:${channel.pid}` }))
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
