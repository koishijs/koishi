import MongoDatabase, { Config } from './database'
import { Tables, Database, Context, Random, omit, TableType, Query, pick, makeArray, Eval } from 'koishi'
import { QuerySelector } from 'mongodb'

export * from './database'
export default MongoDatabase

declare module 'koishi' {
  interface Database {
    mongo: MongoDatabase
  }

  namespace Database {
    interface Library {
      '@koishijs/plugin-mongo': typeof MongoDatabase
    }
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
      filter[key] = value.map(transformQuery)
    } else if (key === '$not') {
      filter[key] = transformQuery(value)
    } else if (key === '$expr') {
      filter[key] = transformEval(value)
    } else {
      filter[key] = transformFieldQuery(value, key)
    }
  }
  return filter
}

function createFilter<T extends TableType>(name: T, _query: Query<T>) {
  const filter = transformQuery(Query.resolve(name, _query))

  // https://stackoverflow.com/questions/25270396/mongodb-how-to-invert-query-with-not
  if (filter['$not']) {
    filter['$nor'] = [filter['$not']]
    delete filter['$not']
  }

  return filter
}

function transformEval(expr: Eval.Numeric | Eval.Aggregation) {
  if (typeof expr === 'string') {
    return '$' + expr
  } else if (typeof expr === 'number' || typeof expr === 'boolean') {
    return expr
  }

  return Object.fromEntries(Object.entries(expr).map(([key, value]) => {
    if (Array.isArray(value)) {
      return [key, value.map(transformEval)]
    } else {
      return [key, transformEval(value)]
    }
  }))
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
    if (!Array.isArray(primary) && table.type === 'incremental') {
      const [latest] = await this.db.collection(name).find().sort(primary, -1).limit(1).toArray()
      let id = latest ? latest[primary] + 1 : 1
      if (Tables.Field.string.includes(fields[primary].type)) id = id.toString()
      data[primary] = id
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
        ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, transformEval(value)])),
      },
    }]).toArray()
    return data
  },
})

export const name = 'mongo'

export function apply(ctx: Context, config: Config) {
  ctx.database = new MongoDatabase(ctx.app, {
    host: 'localhost',
    name: 'koishi',
    protocol: 'mongodb',
    ...config,
  })
}
