import { MongoClient, Db, Collection } from 'mongodb'
import { Context, Channel, Database, User, Tables as KoishiTables, makeArray, Schema, valueMap, pick, omit, Query } from 'koishi'
import { URLSearchParams } from 'url'
import { createFilter, transformEval } from './utils'

declare module 'koishi' {
  interface Database {
    mongo: MongoDatabase
  }

  interface Modules {
    'database-mongo': typeof import('.')
  }
}

type TableType = keyof Tables

export interface Tables extends KoishiTables {}

class MongoDatabase extends Database {
  public client: MongoClient
  public db: Db

  mongo = this

  user: Collection<User>
  channel: Collection<Channel>

  constructor(public ctx: Context, private config: MongoDatabase.Config) {
    super(ctx)
  }

  async start() {
    const mongourl = this.config.uri || this.connectionStringFromConfig()
    this.client = await MongoClient.connect(
      mongourl, { useNewUrlParser: true, useUnifiedTopology: true },
    )
    this.db = this.client.db(this.config.database)
    if (this.config.prefix) {
      this.db.collection = ((func, prefix) => function collection<T extends TableType>(name: T) {
        return func(`${prefix}.${name}`)
      })(this.db.collection.bind(this.db), this.config.prefix)
    }
    this.user = this.db.collection('user')
    this.channel = this.db.collection('channel')
    await this.channel.createIndex({ type: 1, pid: 1 }, { unique: true })

    for (const name in KoishiTables.config) {
      const { primary } = KoishiTables.config[name]
      const col = this.db.collection(name)
      await col.createIndex(Object.fromEntries(makeArray(primary).map(K => [K, 1])), { unique: true })
    }
  }

  collection<T extends TableType>(name: T): Collection<Tables[T]> {
    return this.db.collection(name)
  }

  stop() {
    return this.client.close()
  }

  connectionStringFromConfig() {
    const { authDatabase, connectOptions, host, database: name, password, port, protocol, username } = this.config
    let mongourl = `${protocol}://`
    if (username) mongourl += `${encodeURIComponent(username)}${password ? `:${encodeURIComponent(password)}` : ''}@`
    mongourl += `${host}${port ? `:${port}` : ''}/${authDatabase || name}`
    if (connectOptions) {
      const params = new URLSearchParams(connectOptions)
      mongourl += `?${params}`
    }
    return mongourl
  }
}

namespace MongoDatabase {
  export const name = 'database-mongo'

  export interface Config {
    username?: string
    password?: string
    protocol?: string
    host?: string
    port?: number
    /** database name */
    database?: string
    prefix?: string
    /** default auth database */
    authDatabase?: string
    connectOptions?: ConstructorParameters<typeof URLSearchParams>[0]
    /** connection string (will overwrite all configs except 'name' and 'prefix') */
    uri?: string
  }

  export const Config = Schema.object({
    protocol: Schema.string('要使用的协议名。').default('mongodb'),
    host: Schema.string('要连接到的主机名。').default('localhost'),
    port: Schema.number('要连接到的端口号。'),
    username: Schema.string('要使用的用户名。'),
    password: Schema.string('要使用的密码。'),
    database: Schema.string('要访问的数据库名。').default('koishi'),
    prefix: Schema.string('使用的表名前缀。当配置了这一项时，所有通过 Koishi 创建的表名都会以这个配置项为前缀。'),
  })
}

Database.extend(MongoDatabase, {
  async drop(table) {
    if (table) {
      await this.db.collection(table).drop()
    } else {
      const collections = await this.db.collections()
      await Promise.all(collections.map(c => c.drop()))
    }
  },

  async get(name, query, modifier) {
    const filter = createFilter(name, query)
    let cursor = this.db.collection(name).find(filter)
    const { fields, limit, offset = 0 } = Query.resolveModifier(modifier)
    cursor = cursor.project({ _id: 0, ...Object.fromEntries((fields ?? []).map(key => [key, 1])) })
    if (offset) cursor = cursor.skip(offset)
    if (limit) cursor = cursor.limit(offset + limit)
    return await cursor.toArray()
  },

  async set(name, query, data) {
    const filter = createFilter(name, query)
    await this.db.collection(name).updateMany(filter, { $set: data })
  },

  async remove(name, query) {
    const filter = createFilter(name, query)
    await this.db.collection(name).deleteMany(filter)
  },

  async create(name, data: any) {
    const table = KoishiTables.config[name]
    const { primary, fields } = table
    if (!Array.isArray(primary) && table.autoInc && !(primary in data)) {
      const [latest] = await this.db.collection(name).find().sort(primary, -1).limit(1).toArray()
      data[primary] = latest ? latest[primary] + 1 : 1
      if (KoishiTables.Field.string.includes(fields[primary].type)) {
        data[primary] += ''
      }
    }
    const copy = { ...KoishiTables.create(name), ...data }
    try {
      await this.db.collection(name).insertOne(copy)
      return copy
    } catch {}
  },

  async upsert(name, data: any[], keys: string | string[]) {
    if (!data.length) return
    if (!keys) keys = KoishiTables.config[name].primary
    keys = makeArray(keys)
    const bulk = this.db.collection(name).initializeUnorderedBulkOp()
    for (const item of data) {
      bulk.find(pick(item, keys))
        .upsert()
        .updateOne({ $set: omit(item, keys), $setOnInsert: omit(KoishiTables.create(name), [...keys, ...Object.keys(item) as any]) })
    }
    await bulk.execute()
  },

  async aggregate(name, fields, query) {
    const $match = createFilter(name, query)
    const [data] = await this.db.collection(name).aggregate([{ $match }, {
      $group: {
        _id: 1,
        ...valueMap(fields, transformEval),
      },
    }]).toArray()
    return data
  },
})

export default MongoDatabase
