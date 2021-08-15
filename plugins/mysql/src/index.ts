import MysqlDatabase, { Config, TableType } from './database'
import { Channel, Database, Context, Query } from 'koishi'
import { OkPacket, escapeId, escape } from 'mysql'
import * as Koishi from 'koishi'

export * from './database'
export default MysqlDatabase

declare module 'koishi' {
  interface Database {
    mysql: MysqlDatabase
  }

  namespace Database {
    interface Library {
      '@koishijs/plugin-mysql': typeof MysqlDatabase
    }
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
  return `FIND_IN_SET(${escape(value)}, ${key})`
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
  $in: (key, value) => createMemberQuery(key, value, ''),
  $nin: (key, value) => createMemberQuery(key, value, ' NOT'),
  $eq: createEqualQuery,
  $ne: comparator('!='),
  $gt: comparator('>'),
  $gte: comparator('>='),
  $lt: comparator('<'),
  $lte: comparator('<='),
  $regex: createRegExpQuery,
  $regexFor: (key, value) => `${escape(value)} REGEXP ${key}`,
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
    return `LENGTH(${key}) - LENGTH(REPLACE(${key}, ",", "")) = ${escape(value)}`
  },
  $bitsAllSet: (key, value) => `${key} & ${escape(value)} = ${escape(value)}`,
  $bitsAllClear: (key, value) => `${key} & ${escape(value)} = 0`,
  $bitsAnySet: (key, value) => `${key} & ${escape(value)} != 0`,
  $bitsAnyClear: (key, value) => `${key} & ${escape(value)} != ${escape(value)}`,
}

export function createFilter<T extends TableType>(name: T, query: Query<T>) {
  function parseQuery(query: Query.Expr) {
    const conditions: string[] = []
    for (const key in query) {
      // logical expression
      if (key === '$not') {
        conditions.push(`!(${parseQuery(query.$not)})`)
        continue
      } else if (key === '$and') {
        if (!query.$and.length) return '0'
        conditions.push(...query.$and.map(parseQuery))
        continue
      } else if (key === '$or' && query.$or.length) {
        conditions.push(`(${query.$or.map(parseQuery).join(' || ')})`)
        continue
      }

      // query shorthand
      const value = query[key]
      const escKey = escapeId(key)
      if (Array.isArray(value)) {
        conditions.push(createMemberQuery(escKey, value))
        continue
      } else if (value instanceof RegExp) {
        conditions.push(createRegExpQuery(escKey, value))
        continue
      } else if (typeof value === 'string' || typeof value === 'number') {
        conditions.push(createEqualQuery(escKey, value))
        continue
      }

      // query expression
      for (const prop in value) {
        if (prop in queryOperators) {
          conditions.push(queryOperators[prop](escKey, value[prop]))
        }
      }
    }

    if (!conditions.length) return '1'
    if (conditions.includes('0')) return '0'
    return conditions.join(' && ')
  }
  return parseQuery(Query.resolve(name, query))
}

Database.extend(MysqlDatabase, {
  async get(name, query, modifier) {
    const filter = createFilter(name, query)
    if (filter === '0') return []
    const { fields, limit, offset } = Query.resolveModifier(modifier)
    const keys = this.joinKeys(this.inferFields(name, fields))
    let sql = `SELECT ${keys} FROM ${name} _${name} WHERE ${filter}`
    if (limit) sql += ' LIMIT ' + limit
    if (offset) sql += ' OFFSET ' + offset
    return this.query(sql)
  },

  async remove(name, query) {
    const filter = createFilter(name, query)
    if (filter === '0') return
    await this.query('DELETE FROM ?? WHERE ' + filter, [name])
  },

  async create(table, data) {
    data = { ...data, ...Koishi.Tables.create(table) }
    const keys = Object.keys(data)
    const header = await this.query<OkPacket>(
      `INSERT INTO ?? (${this.joinKeys(keys)}) VALUES (${keys.map(() => '?').join(', ')})`,
      [table, ...this.formatValues(table, data, keys)],
    )
    return { ...data, id: header.insertId } as any
  },

  async update(table, data) {
    if (!data.length) return
    data = data.map(item => ({ ...item, ...Koishi.Tables.create(table) }))
    const keys = Object.keys(data[0])
    const placeholder = `(${keys.map(() => '?').join(', ')})`
    const update = keys.filter(key => key !== 'id').map((key) => {
      key = escapeId(key)
      return `${key} = VALUES(${key})`
    }).join(', ')
    await this.query(
      `INSERT INTO ${escapeId(table)} (${this.joinKeys(keys)}) VALUES ${data.map(() => placeholder).join(', ')}
      ON DUPLICATE KEY UPDATE ${update}`,
      [].concat(...data.map(data => this.formatValues(table, data, keys))),
    )
  },

  async getAssignedChannels(fields, assignMap = this.app.getSelfIds()) {
    return this.select<Channel>('channel', fields, Object.entries(assignMap).map(([type, ids]) => {
      return [
        `LEFT(\`id\`, ${type.length}) = ${this.escape(type)}`,
        `\`assignee\` IN (${ids.map(id => this.escape(id)).join(',')})`,
      ].join(' AND ')
    }).join(' OR '))
  },
})

export const name = 'mysql'

export function apply(ctx: Context, config: Config = {}) {
  ctx.database = new MysqlDatabase(ctx.app, config)
}
