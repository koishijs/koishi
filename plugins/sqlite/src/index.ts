import SqliteDatabase, { Config } from './database'
import { Database, Context, Query, Eval, makeArray, difference, Schema } from 'koishi'
import { escapeId, escape } from './utils'
import * as Koishi from 'koishi'

export * from './database'
export default SqliteDatabase

declare module 'koishi' {
  interface Database {
    sqlite: SqliteDatabase
  }

  interface Modules {
    sqlite: typeof import('.')
  }
}

function createMemberQuery(key: string, value: any[], notStr = '') {
  if (!value.length) return notStr ? '1' : '0'
  return `${key}${notStr} IN (${value.map(val => escape(val)).join(', ')})`
}

function createRegExpQuery(key: string, value: RegExp) {
  return `${key} REGEXP ${escape(value.source)}`
}

function createElementQuery(key: string, value: any) {
  return `(',' || ${key} || ',') LIKE '%,${escape(value)},%'`
}

function comparator(operator: string) {
  return function (key: string, value: any) {
    return `${key} ${operator} ${escape(value)}`
  }
}

const createEqualQuery = comparator('=')

type QueryOperators = {
  [K in keyof Query.FieldExpr]?: (key: string, value: Query.FieldExpr[K]) => string
}

const queryOperators: QueryOperators = {
  // logical
  $or: (key, value) => logicalOr(value.map(value => parseFieldQuery(key, value))),
  $and: (key, value) => logicalAnd(value.map(value => parseFieldQuery(key, value))),
  $not: (key, value) => logicalNot(parseFieldQuery(key, value)),

  // comparison
  $eq: createEqualQuery,
  $ne: comparator('!='),
  $gt: comparator('>'),
  $gte: comparator('>='),
  $lt: comparator('<'),
  $lte: comparator('<='),

  // membership
  $in: (key, value) => createMemberQuery(key, value, ''),
  $nin: (key, value) => createMemberQuery(key, value, ' NOT'),

  // regexp
  $regex: createRegExpQuery,
  $regexFor: (key, value) => `${escape(value)} REGEXP ${key}`,

  // bitwise
  $bitsAllSet: (key, value) => `${key} & ${escape(value)} = ${escape(value)}`,
  $bitsAllClear: (key, value) => `${key} & ${escape(value)} = 0`,
  $bitsAnySet: (key, value) => `${key} & ${escape(value)} != 0`,
  $bitsAnyClear: (key, value) => `${key} & ${escape(value)} != ${escape(value)}`,

  // list
  $el: (key, value) => {
    if (Array.isArray(value)) {
      return `(${value.map(value => createElementQuery(key, value)).join(' || ')})`
    } else if (typeof value !== 'number' && typeof value !== 'string') {
      throw new TypeError('query expr under $el is not supported')
    } else {
      return createElementQuery(key, value)
    }
  },
  $size: (key, value) => {
    if (!value) return `!${key}`
    return `${key} AND LENGTH(${key}) - LENGTH(REPLACE(${key}, ',', '')) = ${escape(value)} - 1`
  },
}

type EvaluationOperators = {
  [K in keyof Eval.GeneralExpr]?: (expr: Eval.GeneralExpr[K]) => string
}

function binary(operator: string) {
  return function ([left, right]: [Eval.Any, Eval.Any]) {
    return `(${parseEval(left)} ${operator} ${parseEval(right)})`
  }
}

const evalOperators: EvaluationOperators = {
  // numeric
  $add: (args) => `(${args.map(parseEval).join(' + ')})`,
  $multiply: (args) => `(${args.map(parseEval).join(' * ')})`,
  $subtract: binary('-'),
  $divide: binary('/'),

  // boolean
  $eq: binary('='),
  $ne: binary('!='),
  $gt: binary('>'),
  $gte: binary('>='),
  $lt: binary('<'),
  $lte: binary('<='),

  // aggregation
  $sum: (expr) => `ifnull(sum(${parseEval(expr)}), 0)`,
  $avg: (expr) => `avg(${parseEval(expr)})`,
  $min: (expr) => `$min(${parseEval(expr)})`,
  $max: (expr) => `max(${parseEval(expr)})`,
  $count: (expr) => `count(distinct ${parseEval(expr)})`,
}

function logicalAnd(conditions: string[]) {
  if (!conditions.length) return '1'
  if (conditions.includes('0')) return '0'
  return conditions.join(' AND ')
}

function logicalOr(conditions: string[]) {
  if (!conditions.length) return '0'
  if (conditions.includes('1')) return '1'
  return `(${conditions.join(' OR ')})`
}

function logicalNot(condition: string) {
  return `NOT (${condition})`
}

function parseFieldQuery(key: string, query: Query.FieldExpr) {
  const conditions: string[] = []

  // query shorthand
  if (Array.isArray(query)) {
    conditions.push(createMemberQuery(key, query))
  } else if (query instanceof RegExp) {
    conditions.push(createRegExpQuery(key, query))
  } else if (typeof query === 'string' || typeof query === 'number' || query instanceof Date) {
    conditions.push(createEqualQuery(key, query))
  } else {
    // query expression
    for (const prop in query) {
      if (prop in queryOperators) {
        conditions.push(queryOperators[prop](key, query[prop]))
      }
    }
  }

  return logicalAnd(conditions)
}

function parseQuery(query: Query.Expr) {
  const conditions: string[] = []
  for (const key in query) {
    // logical expression
    if (key === '$not') {
      conditions.push(logicalNot(parseQuery(query.$not)))
    } else if (key === '$and') {
      conditions.push(logicalAnd(query.$and.map(parseQuery)))
    } else if (key === '$or') {
      conditions.push(logicalOr(query.$or.map(parseQuery)))
    } else if (key === '$expr') {
      conditions.push(parseEval(query.$expr))
    } else {
      conditions.push(parseFieldQuery(escapeId(key), query[key]))
    }
  }

  return logicalAnd(conditions)
}

function parseEval(expr: Eval.Any | Eval.Aggregation): string {
  if (typeof expr === 'string') {
    return escapeId(expr)
  } else if (typeof expr === 'number' || typeof expr === 'boolean') {
    return escape(expr)
  }

  for (const key in expr) {
    if (key in evalOperators) {
      return evalOperators[key](expr[key])
    }
  }
}

Database.extend(SqliteDatabase, {
  async drop(name) {
    if (name) {
      await this._dropTable(name)
    } else {
      await this._dropAll()
    }
  },

  async get(name, query, modifier) {
    const filter = parseQuery(Query.resolve(name, query))
    if (filter === '0') return []
    const { fields, limit, offset } = Query.resolveModifier(modifier)
    let sql = `SELECT ${this._joinKeys(fields)} FROM ${escapeId(name)} WHERE ${filter}`
    if (limit) sql += ' LIMIT ' + limit
    if (offset) sql += ' OFFSET ' + offset
    const rows = this.all(sql)
    const adapter = this._getDbAdapter(name)
    return rows.map(row => adapter.dbToLocal(row))
  },

  async set(name, query, data) {
    const filter = parseQuery(Query.resolve(name, query))
    if (filter === '0') return
    const adapter = this._getDbAdapter(name)
    data = adapter.localToDb(data)
    const update = Object.keys(data).map((key) => {
      return `${escapeId(key)} = ${escape(data[key])}`
    }).join(', ')
    this.run(`UPDATE ${name} SET ${update} WHERE ${filter}`)
  },

  async remove(name, query) {
    const filter = parseQuery(Query.resolve(name, query))
    if (filter === '0') return
    this.run(`DELETE FROM ${name} WHERE ${filter}`)
  },

  async create(name, data) {
    const adapter = this._getDbAdapter(name)
    data = { ...Koishi.Tables.create(name), ...data }
    data = adapter.localToDb(data)
    const keys = Object.keys(data)
    const result = this.run(
      `INSERT INTO ${name} (${this._joinKeys(keys)}) VALUES (${keys.map(key => escape(data[key])).join(', ')})`,
    )
    const config = Koishi.Tables.config[name]
    if (config?.autoInc) {
      return { ...data, [config.primary as string]: result.lastInsertRowid } as any
    }
    return data as any
  },

  async upsert(name, data, keys: string | string[]) {
    if (!data.length) return
    const { fields, primary } = Koishi.Tables.config[name]
    const fallback = Koishi.Tables.create(name)
    const initKeys = Object.keys(fields)
    const updateKeys = Object.keys(data[0])
    const adapter = this._getDbAdapter(name)
    data = data.map(item => ({ ...fallback, ...adapter.localToDb(item) }))
    keys = makeArray(keys || primary)
    const update = difference(updateKeys, keys).map((key) => {
      key = escapeId(key)
      return `${key} = VALUES(${key})`
    }).join(', ')
    this.run(
      `INSERT INTO ${escapeId(name)} (${this._joinKeys(initKeys)})
      VALUES ${data.map(item => `(${initKeys.map(key => escape(item[key])).join(', ')})`).join(', ')}
      ON DUPLICATE KEY UPDATE ${update}`,
    )
  },

  async aggregate(name, fields, query) {
    const keys = Object.keys(fields)
    if (!keys.length) return {}

    const filter = parseQuery(Query.resolve(name, query))
    const exprs = keys.map(key => `${parseEval(fields[key])} AS ${escapeId(key)}`).join(', ')
    const data = await this.get(`SELECT ${exprs} FROM ${name} WHERE ${filter}`)
    return data
  },
})

export const name = 'sqlite'

export const schema: Schema<Config> = Schema.object({
  path: Schema.string('数据库路径').default('.koishi.db'),
}, true)

export function apply(ctx: Context, config: Config = {}) {
  config = Schema.validate(config, schema)
  ctx.database = new SqliteDatabase(ctx.app, config)
}
