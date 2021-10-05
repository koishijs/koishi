import { Database, Eval, Query, Tables, clone, makeArray, pick, Context, valueMap, Schema } from 'koishi'
import { LevelDatabase, Config } from './database'

/**
 * LevelDB database
 * storage format: _makeKey(obj) -> obj
 * TODOs:
 * - support for unique indexes (using #index$table$field -> primary key map)
 * - optimize for indexed reads
 * - support cache API
 */

declare module 'koishi' {
  interface Database {
    level: LevelDatabase
  }

  interface Modules {
    level: typeof import('.')
  }
}

type QueryOperators = {
  [K in keyof Query.FieldExpr]?: (query: Query.FieldExpr[K], data: any) => boolean
}

const queryOperators: QueryOperators = {
  // logical
  $or: (query, data) => query.reduce((prev, query) => prev || executeFieldQuery(query, data), false),
  $and: (query, data) => query.reduce((prev, query) => prev && executeFieldQuery(query, data), true),
  $not: (query, data) => !executeFieldQuery(query, data),

  // comparison
  $eq: (query, data) => data.valueOf() === query.valueOf(),
  $ne: (query, data) => data.valueOf() !== query.valueOf(),
  $gt: (query, data) => data.valueOf() > query.valueOf(),
  $gte: (query, data) => data.valueOf() >= query.valueOf(),
  $lt: (query, data) => data.valueOf() < query.valueOf(),
  $lte: (query, data) => data.valueOf() <= query.valueOf(),

  // membership
  $in: (query, data) => query.includes(data),
  $nin: (query, data) => !query.includes(data),

  // regexp
  $regex: (query, data) => query.test(data),
  $regexFor: (query, data) => new RegExp(data, 'i').test(query),

  // bitwise
  $bitsAllSet: (query, data) => (query & data) === query,
  $bitsAllClear: (query, data) => (query & data) === 0,
  $bitsAnySet: (query, data) => (query & data) !== 0,
  $bitsAnyClear: (query, data) => (query & data) !== query,

  // list
  $el: (query, data) => data.some(item => executeFieldQuery(query, item)),
  $size: (query, data) => data.length === query,
}

type EvalOperators = {
  [K in keyof Eval.GeneralExpr]?: (args: Eval.GeneralExpr[K], data: any) => any
}

const evalOperators: EvalOperators = {
  // numeric
  $add: (args, data) => args.reduce<number>((prev, curr) => prev + executeEval(curr, data), 0),
  $multiply: (args, data) => args.reduce<number>((prev, curr) => prev * executeEval(curr, data), 1),
  $subtract: ([left, right], data) => executeEval(left, data) - executeEval(right, data),
  $divide: ([left, right], data) => executeEval(left, data) - executeEval(right, data),

  // boolean
  $eq: ([left, right], data) => executeEval(left, data).valueOf() === executeEval(right, data).valueOf(),
  $ne: ([left, right], data) => executeEval(left, data).valueOf() !== executeEval(right, data).valueOf(),
  $gt: ([left, right], data) => executeEval(left, data).valueOf() > executeEval(right, data).valueOf(),
  $gte: ([left, right], data) => executeEval(left, data).valueOf() >= executeEval(right, data).valueOf(),
  $lt: ([left, right], data) => executeEval(left, data).valueOf() < executeEval(right, data).valueOf(),
  $lte: ([left, right], data) => executeEval(left, data).valueOf() <= executeEval(right, data).valueOf(),

  // aggregation
  $sum: (expr, table: any[]) => table.reduce((prev, curr) => prev + executeEval(expr, curr), 0),
  $avg: (expr, table: any[]) => table.reduce((prev, curr) => prev + executeEval(expr, curr), 0) / table.length,
  $min: (expr, table: any[]) => Math.min(...table.map(data => executeEval(expr, data))),
  $max: (expr, table: any[]) => Math.max(...table.map(data => executeEval(expr, data))),
  $count: (expr, table: any[]) => new Set(table.map(data => executeEval(expr, data))).size,
}

function executeFieldQuery(query: Query.FieldQuery, data: any) {
  // shorthand syntax
  if (Array.isArray(query)) {
    return query.includes(data)
  } else if (query instanceof RegExp) {
    return query.test(data)
  } else if (typeof query === 'string' || typeof query === 'number' || query instanceof Date) {
    return data.valueOf() === query.valueOf()
  }

  for (const key in query) {
    if (key in queryOperators) {
      if (!queryOperators[key](query[key], data)) return false
    }
  }

  return true
}

function executeQuery(query: Query.Expr, data: any): boolean {
  const entries: [string, any][] = Object.entries(query)
  return entries.every(([key, value]) => {
    // execute logical query
    if (key === '$and') {
      return (value as Query.Expr[]).reduce((prev, query) => prev && executeQuery(query, data), true)
    } else if (key === '$or') {
      return (value as Query.Expr[]).reduce((prev, query) => prev || executeQuery(query, data), false)
    } else if (key === '$not') {
      return !executeQuery(value, data)
    } else if (key === '$expr') {
      return executeEval(value, data)
    }

    // execute field query
    try {
      if (!(key in data)) return false
      return executeFieldQuery(value, data[key])
    } catch {
      return false
    }
  })
}

function executeEval(expr: Eval.Any | Eval.Aggregation, data: any) {
  if (typeof expr === 'string') {
    return data[expr]
  } else if (typeof expr === 'number' || typeof expr === 'boolean') {
    return expr
  }

  for (const key in expr) {
    if (key in evalOperators) {
      return evalOperators[key](expr[key], data)
    }
  }
}

function isDirectFieldQuery(q: Query.FieldQuery) {
  return typeof q === 'string' || typeof q === 'number'
}

Database.extend(LevelDatabase, {
  async drop(name) {
    if (name) {
      this._dropTable(name)
    } else {
      this._clear()
    }
  },

  async get(name, query, modifier) {
    const expr = Query.resolve(name, query)
    const { fields, limit = Infinity, offset = 0 } = Query.resolveModifier(modifier)

    const { primary } = Tables.config[name] as Tables.Config
    // Direct read
    if (makeArray(primary).every(key => isDirectFieldQuery(expr[key]))) {
      const key = this._makeKey(name, primary, expr)
      try {
        const value = await this._level.get(key)
        if (offset === 0 && limit > 0 && executeQuery(expr, value)) {
          return [pick(value, fields)]
        }
      } catch (e) {
        if (e.notFound !== true) throw e
      }
      return []
    }

    const result: any[] = []
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const [_, value] of this._table(name)) {
      if (executeQuery(expr, value)) {
        result.push(pick(value, fields))
      }
    }
    return result.slice(offset, offset + limit)
  },

  async set(name, query, data) {
    const { primary } = Tables.config[name] as Tables.Config
    if (makeArray(primary).some(key => key in data)) {
      process.emitWarning(new Error('Cannot update primary key!'))
      return
    }

    const expr = Query.resolve(name, query)
    // Direct update
    if (makeArray(primary).every(key => isDirectFieldQuery(expr[key]))) {
      const key = this._makeKey(name, primary, expr)
      try {
        const value = await this._level.get(key)
        if (executeQuery(expr, value)) {
          await this._level.put(key, Object.assign(value, data))
        }
      } catch (e) {
        if (e.notFound !== true) throw e
      }
      return
    }

    const ops: any[] = []
    // @ts-ignore
    for await (const [key, value] of this._table(name)) {
      if (executeQuery(expr, value)) {
        ops.push({ type: 'put', key, value: Object.assign(value, data) })
      }
    }
    await this._level.batch(ops)
  },

  async remove(name, query) {
    const expr = Query.resolve(name, query)

    const { primary } = Tables.config[name] as Tables.Config
    // Direct delete
    if (makeArray(primary).every(key => isDirectFieldQuery(expr[key]))) {
      const key = this._makeKey(name, primary, expr)
      try {
        const value = await this._level.get(key)
        if (executeQuery(expr, value)) {
          await this._level.del(key)
        }
      } catch (e) {
        if (e.notFound !== true) throw e
      }
      return
    }

    const ops: any[] = []
    // @ts-ignore
    for await (const [key, value] of this._table(name)) {
      if (executeQuery(expr, value)) {
        ops.push({ type: 'del', key })
      }
    }
    await this._level.batch(ops)
  },

  async create(name, data: any, forced?: boolean) {
    const { primary, fields, autoInc } = Tables.config[name] as Tables.Config
    data = clone(data)
    if (!Array.isArray(primary) && autoInc && !(primary in data)) {
      const max = await this._maxKey(name)
      data[primary] = max + 1
      if (Tables.Field.string.includes(fields[primary].type)) {
        data[primary] += ''
      }
    }
    const key = this._makeKey(name, primary, data)
    if (!forced && await this._exists(key)) return
    const copy = { ...Tables.create(name), ...data }
    await this._level.put(key, copy)
    return copy
  },

  async upsert(name, data, key) {
    const { primary } = Tables.config[name] as Tables.Config
    const keys = makeArray(key || Tables.config[name].primary)
    for (const item of data) {
      // Direct upsert
      if (makeArray(primary).every(key => key in item)) {
        const key = this._makeKey(name, primary, item)
        try {
          const value = await this._level.get(key)
          if (keys.every(key => value[key] === item[key])) {
            await this._level.put(key, Object.assign(value, item))
          }
        } catch (e) {
          if (e.notFound !== true) throw e
          // @ts-ignore
          await this.create(name, item, true)
        }
        continue
      }

      let insert: boolean = true
      // @ts-ignore
      for await (const [key, value] of this._table(name)) {
        if (keys.every(key => value[key] === item[key])) {
          insert = false
          const { primary } = Tables.config[name] as Tables.Config
          if (makeArray(primary).some(key => (key in data) && value[key] !== data[key])) {
            process.emitWarning(new Error('Cannot update primary key!'))
            break
          }
          await this._level.put(key, Object.assign(value, data))
          // Match the behavior here
          // mongo/src/index.ts > upsert() > bulk.find(pick(item, keys)).updateOne({ $set: omit(item, keys) })
          break
        }
      }
      if (insert) {
        // @ts-ignore
        await this.create(name, item, true)
      }
    }
  },

  async aggregate(name, fields, query) {
    const expr = Query.resolve(name, query)
    const result: any[] = []
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const [_, value] of this._table(name)) {
      if (executeQuery(expr, value)) {
        result.push(value)
      }
    }
    return valueMap(fields, expr => executeEval(expr, result))
  },
})

export const name = 'level'

export const schema: Schema<Config> = Schema.object({
  path: Schema.string('数据保存的位置').required(),
})

export function apply(ctx: Context, config: Config) {
  config = Schema.validate(config, schema)
  ctx.database = new LevelDatabase(ctx.app, config)
}
