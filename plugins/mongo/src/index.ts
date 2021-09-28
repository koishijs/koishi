import MongoDatabase, { Config } from './database'
import { Tables, Database, Context, omit, TableType, Query, pick, makeArray, Eval, valueMap, Schema } from 'koishi'
import { QuerySelector } from 'mongodb'

export * from './database'
export default MongoDatabase

declare module 'koishi' {
  interface Database {
    mongo: MongoDatabase
  }

  interface Modules {
    mongo: typeof import('.')
  }
}

function transformFieldQuery(query: Query.FieldQuery, key: string) {
  // shorthand syntax
  if (typeof query === 'string' || typeof query === 'number' || query instanceof Date) {
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

function transformQuery(query: Query.Expr) {
  const filter = {}
  for (const key in query) {
    const value = query[key]
    if (key === '$and' || key === '$or') {
      // MongoError: $and/$or/$nor must be a nonempty array
      if (value.length) {
        filter[key] = value.map(transformQuery)
      } else if (key === '$or') {
        return { $nor: [{}] }
      }
    } else if (key === '$not') {
      // MongoError: unknown top level operator: $not
      // https://stackoverflow.com/questions/25270396/mongodb-how-to-invert-query-with-not
      filter['$nor'] = [transformQuery(value)]
    } else if (key === '$expr') {
      filter[key] = transformEval(value)
    } else {
      filter[key] = transformFieldQuery(value, key)
    }
  }
  return filter
}

function createFilter<T extends TableType>(name: T, query: Query<T>) {
  const filter = transformQuery(Query.resolve(name, query))
  return filter
}

function transformEval(expr: Eval.Numeric | Eval.Aggregation) {
  if (typeof expr === 'string') {
    return '$' + expr
  } else if (typeof expr === 'number' || typeof expr === 'boolean') {
    return expr
  }

  return valueMap(expr as any, (value) => {
    if (Array.isArray(value)) {
      return value.map(transformEval)
    } else {
      return transformEval(value)
    }
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
    if (fields) cursor = cursor.project(Object.fromEntries(fields.map(key => [key, 1])))
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
    const table = Tables.config[name]
    const { primary, fields } = table
    if (!Array.isArray(primary) && table.autoInc) {
      const [latest] = await this.db.collection(name).find().sort(primary, -1).limit(1).toArray()
      data[primary] = latest ? latest[primary] + 1 : 1
      if (Tables.Field.string.includes(fields[primary].type)) {
        data[primary] += ''
      }
    }
    const copy = { ...Tables.create(name), ...data }
    await this.db.collection(name).insertOne(copy).catch(() => {})
    return copy
  },

  async upsert(name, data: any[], keys: string | string[]) {
    if (!data.length) return
    if (!keys) keys = Tables.config[name].primary
    keys = makeArray(keys)
    const bulk = this.db.collection(name).initializeUnorderedBulkOp()
    for (const item of data) {
      bulk.find(pick(item, keys)).updateOne({ $set: omit(item, keys) })
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

export const name = 'mongo'

export const schema: Schema<Config> = Schema.object({
  protocol: Schema.string('要使用的协议名。').default('mongodb'),
  host: Schema.string('要连接到的主机名。').default('localhost'),
  port: Schema.number('要连接到的端口号。').default(3306),
  username: Schema.string('要使用的用户名。'),
  password: Schema.string('要使用的密码。'),
  database: Schema.string('要访问的数据库名。').default('koishi'),
  prefix: Schema.string('使用的表名前缀。当配置了这一项时，所有通过 Koishi 创建的表名都会以这个配置项为前缀。'),
})

export function apply(ctx: Context, config: Config) {
  ctx.database = new MongoDatabase(ctx.app, {
    host: 'localhost',
    database: 'koishi',
    protocol: 'mongodb',
    ...config,
  })
}
