import MongoDatabase, { Config } from './database'
import { User, Tables, Database, Field, Context, Channel, Random, pick, omit, TableType, Query } from 'koishi-core'
import { QuerySelector } from 'mongodb'

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

function transformFieldQuery(query: Query.FieldQuery, key: string) {
  // shorthand syntax
  if (typeof query === 'string' || typeof query === 'number') {
    return { $eq: query }
  } else if (Array.isArray(query)) {
    if (!query.length) return
    return { $in: query }
  } else if (query instanceof RegExp) {
    return { $regex: query }
  }

  // query operators
  const result: QuerySelector<any> = {}
  for (const prop in query) {
    if (prop === '$el') {
      result.$elemMatch = transformFieldQuery(query[prop], key)
    } else if (prop === '$regexFor') {
      result.$expr = {
        body(data: string, value: string) {
          return new RegExp(data, 'i').test(value)
        },
        args: ['$' + key, query],
        lang: 'js',
      }
    } else {
      result[prop] = query[prop]
    }
  }
  return result
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
      } else {
        filter[key] = transformFieldQuery(value, key)
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

function getFallbackType({ fields, primary }: Tables.Meta) {
  const { type } = fields[primary]
  return Field.stringTypes.includes(type) ? 'random' : 'incremental'
}

Database.extend(MongoDatabase, {
  async get(name, query, modifier) {
    const filter = createFilter(name, query)
    if (!filter) return []
    let cursor = this.db.collection(name).find(filter)
    const { fields, limit, offset = 0 } = Query.resolveModifier(modifier)
    if (fields) cursor = cursor.project(Object.fromEntries(fields.map(key => [key, 1])))
    if (offset) cursor = cursor.skip(offset)
    if (limit) cursor = cursor.limit(offset + limit)
    const data = await cursor.toArray()
    const { primary } = Tables.config[name]
    if (fields.includes(primary as never)) {
      for (const item of data) {
        item[primary] ??= item._id
      }
    }
    return data
  },

  async remove(name, query) {
    const filter = createFilter(name, query)
    if (!filter) return
    await this.db.collection(name).deleteMany(filter)
  },

  async create(name, data: any) {
    const meta = Tables.config[name]
    const { primary, type = getFallbackType(meta) } = meta
    const copy = { ...data }
    if (copy[primary]) {
      copy['_id'] = copy[primary]
      delete copy[primary]
    } else if (type === 'incremental') {
      const [latest] = await this.db.collection(name).find().sort('_id', -1).limit(1).toArray()
      copy['_id'] = data[primary] = latest ? latest._id + 1 : 1
    } else if (type === 'random') {
      copy['_id'] = data[primary] = Random.uuid()
    }
    await this.db.collection(name).insertOne(copy).catch(() => {})
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

  async getUser(type, id, modifier) {
    const { fields } = Query.resolveModifier(modifier)
    const applyDefault = (user: User) => ({
      ...pick(User.create(type, user[type]), fields),
      ...unescapeKey(user),
    })

    const data = await this.get('user', { [type]: id }, modifier)
    if (Array.isArray(id)) {
      return data.map(applyDefault)
    } else if (data[0]) {
      return { ...applyDefault(data[0]), [type]: id }
    }
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

  async getChannel(type, pid, modifier) {
    modifier = Query.resolveModifier(modifier)
    const fields = modifier.fields.slice()
    const applyDefault = (channel: Channel) => ({
      ...pick(Channel.create(type, channel.pid), fields),
      ...omit(channel, ['type', 'pid']),
    })

    const index = fields.indexOf('id')
    if (Array.isArray(pid)) {
      const ids = pid.map(id => `${type}:${id}`)
      if (fields && !fields.length) return ids.map(id => ({ id }))
      if (index >= 0) modifier.fields.splice(index, 1, 'type', 'pid')
      const data = await this.get('channel', ids, modifier)
      return data.map(applyDefault)
    } else {
      const id = `${type}:${pid}`
      if (fields && !fields.length) return { id }
      if (index >= 0) modifier.fields.splice(index, 1)
      const data = await this.get('channel', id, modifier)
      return data[0] && { ...applyDefault(data[0]), id }
    }
  },

  async getAssignedChannels(_fields, assignMap = this.app.getSelfIds()) {
    const fields = _fields.slice()
    const applyDefault = (channel: Channel) => ({
      ...pick(Channel.create(channel.type, channel.pid), _fields),
      ...omit(channel, ['type', 'pid']),
    })

    const index = fields.indexOf('id')
    if (index >= 0) fields.splice(index, 1, 'type', 'pid')
    const data = await this.get('channel', {
      $or: Object.entries(assignMap).map<any>(([type, assignee]) => ({ type, assignee })),
    }, fields)
    return data.map(applyDefault)
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
  const db = new MongoDatabase(ctx.app, { host: 'localhost', name: 'koishi', protocol: 'mongodb', ...config })
  ctx.database = db as any
  ctx.before('connect', () => db.start())
  ctx.before('disconnect', () => db.stop())
}
