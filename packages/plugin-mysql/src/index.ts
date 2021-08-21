import MysqlDatabase, { Config } from './database'
import { User, Channel, Database, Context, Query, Eval } from 'koishi-core'
import { difference } from 'koishi-utils'
import { OkPacket, escapeId, escape } from 'mysql'
import * as Koishi from 'koishi-core'

export * from './database'
export default MysqlDatabase

declare module 'koishi-core' {
  interface Database {
    mysql: MysqlDatabase
  }

  namespace Database {
    interface Statics {
      'koishi-plugin-mysql': typeof MysqlDatabase
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
    return `${key} && LENGTH(${key}) - LENGTH(REPLACE(${key}, ",", "")) = ${escape(value)} - 1`
  },
  $bitsAllSet: (key, value) => `${key} & ${escape(value)} = ${escape(value)}`,
  $bitsAllClear: (key, value) => `${key} & ${escape(value)} = 0`,
  $bitsAnySet: (key, value) => `${key} & ${escape(value)} != 0`,
  $bitsAnyClear: (key, value) => `${key} & ${escape(value)} != ${escape(value)}`,
}

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
    } else if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
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

function parseNumeric(expr: Eval.Aggregation | Eval.Numeric) {
  if (typeof expr === 'string') {
    return escapeId(expr)
  } else if (typeof expr === 'number') {
    return escape(expr)
  } else if ('$sum' in expr) {
    return `ifnull(sum(${parseNumeric(expr.$sum)}), 0)`
  } else if ('$avg' in expr) {
    return `avg(${parseNumeric(expr.$avg)})`
  } else if ('$min' in expr) {
    return `min(${parseNumeric(expr.$min)})`
  } else if ('$max' in expr) {
    return `max(${parseNumeric(expr.$max)})`
  } else if ('$count' in expr) {
    return `count(${parseNumeric(expr.$count)})`
  } else if ('$add' in expr) {
    return expr.$add.map(parseNumeric).join(' + ')
  } else if ('$multiply' in expr) {
    return expr.$multiply.map(parseNumeric).join(' * ')
  } else if ('$subtract' in expr) {
    return expr.$subtract.map(parseNumeric).join(' - ')
  } else if ('$divide' in expr) {
    return expr.$divide.map(parseNumeric).join(' / ')
  }
}

Database.extend(MysqlDatabase, {
  async drop(name) {
    if (name) {
      await this.query(`DROP TABLE ${escapeId(name)}`)
    } else {
      const data = await this.select('information_schema.tables', ['TABLE_NAME'], 'TABLE_SCHEMA = ?', [this.config.database])
      await this.query(data.map(({ TABLE_NAME }) => `DROP TABLE ${escapeId(TABLE_NAME)}`).join('; '))
    }
  },

  async get(name, query, modifier) {
    const filter = parseQuery(Query.resolve(name, query))
    if (filter === '0') return []
    const { fields, limit, offset } = Query.resolveModifier(modifier)
    const keys = this.joinKeys(this.inferFields(name, fields))
    let sql = `SELECT ${keys} FROM ${name} _${name} WHERE ${filter}`
    if (limit) sql += ' LIMIT ' + limit
    if (offset) sql += ' OFFSET ' + offset
    return this.query(sql)
  },

  async remove(name, query) {
    const filter = parseQuery(Query.resolve(name, query))
    if (filter === '0') return
    await this.query('DELETE FROM ?? WHERE ' + filter, [name])
  },

  async create(name, data) {
    data = { ...Koishi.Tables.create(name), ...data }
    const keys = Object.keys(data)
    const header = await this.query<OkPacket>(
      `INSERT INTO ?? (${this.joinKeys(keys)}) VALUES (${keys.map(() => '?').join(', ')})`,
      [name, ...this.formatValues(name, data, keys)],
    )
    return { ...data, id: header.insertId } as any
  },

  async update(name, data, key: string) {
    if (!data.length) return
    key ||= Koishi.Tables.config[name].primary
    data = data.map(item => ({ ...Koishi.Tables.create(name), ...item }))
    const fields = Object.keys(data[0])
    const placeholder = `(${fields.map(() => '?').join(', ')})`
    const update = difference(fields, [key]).map((key) => {
      key = escapeId(key)
      return `${key} = VALUES(${key})`
    }).join(', ')
    await this.query(
      `INSERT INTO ${escapeId(name)} (${this.joinKeys(fields)}) VALUES ${data.map(() => placeholder).join(', ')}
      ON DUPLICATE KEY UPDATE ${update}`,
      [].concat(...data.map(data => this.formatValues(name, data, fields))),
    )
  },

  async aggregate(name, fields, query) {
    const keys = Object.keys(fields)
    if (!keys.length) return {}

    const filter = parseQuery(Query.resolve(name, query))
    const exprs = keys.map(key => `${parseNumeric(fields[key])} AS ${escapeId(key)}`).join(', ')
    const [data] = await this.query(`SELECT ${exprs} FROM ${name} WHERE ${filter}`)
    return data
  },

  async getUser(type, id, modifier) {
    const { fields } = Query.resolveModifier(modifier)
    if (fields && !fields.length) {
      return Array.isArray(id) ? id.map(id => ({ [type]: id })) : { [type]: id }
    }
    const data = await this.get('user', { [type]: id }, modifier)
    if (Array.isArray(id)) return data
    return data[0] && { ...data[0], [type]: id }
  },

  async createUser(type, id, data) {
    data[type] = id
    const newKeys = Object.keys(data)
    const assignments = difference(newKeys, [type]).map((key) => {
      key = this.escapeId(key)
      return `${key} = VALUES(${key})`
    }).join(', ')
    const user = Object.assign(User.create(type, id), data)
    const keys = Object.keys(user)
    await this.query(
      `INSERT INTO ?? (${this.joinKeys(keys)}) VALUES (${keys.map(() => '?').join(', ')})
      ON DUPLICATE KEY UPDATE ${assignments}`,
      ['user', ...this.formatValues('user', user, keys)],
    )
  },

  async setUser(type, id, data) {
    data[type] = id
    const keys = Object.keys(data)
    const assignments = difference(keys, [type]).map((key) => {
      return `${this.escapeId(key)} = ${this.escape(data[key], 'user', key)}`
    }).join(', ')
    await this.query(`UPDATE ?? SET ${assignments} WHERE ?? = ?`, ['user', type, id])
  },

  async getChannel(type, pid, modifier) {
    const { fields } = Query.resolveModifier(modifier)
    if (fields && !fields.length) {
      return Array.isArray(pid) ? pid.map(id => ({ id: `${type}:${id}` })) : { id: `${type}:${pid}` }
    }
    const id = Array.isArray(pid) ? pid.map(id => `${type}:${id}`) : `${type}:${pid}`
    const data = await this.get('channel', { id }, modifier)
    if (Array.isArray(pid)) return data
    return data[0] && { ...data[0], id: `${type}:${pid}` }
  },

  async getAssignedChannels(fields, assignMap = this.app.getSelfIds()) {
    return this.select<Channel>('channel', fields, Object.entries(assignMap).map(([type, ids]) => {
      return [
        `LEFT(\`id\`, ${type.length}) = ${this.escape(type)}`,
        `\`assignee\` IN (${ids.map(id => this.escape(id)).join(',')})`,
      ].join(' AND ')
    }).join(' OR '))
  },

  async createChannel(type, pid, data) {
    data.id = `${type}:${pid}`
    const newKeys = Object.keys(data)
    if (!newKeys.length) return
    const assignments = difference(newKeys, ['id']).map((key) => {
      key = this.escapeId(key)
      return `${key} = VALUES(${key})`
    })
    const channel = Object.assign(Channel.create(type, pid), data)
    const keys = Object.keys(channel)
    await this.query(
      `INSERT INTO ?? (${this.joinKeys(keys)}) VALUES (${keys.map(() => '?').join(', ')})
      ON DUPLICATE KEY UPDATE ${assignments.join(', ')}`,
      ['channel', ...this.formatValues('channel', channel, keys)],
    )
  },

  async setChannel(type, pid, data) {
    data.id = `${type}:${pid}`
    const keys = Object.keys(data)
    if (!keys.length) return
    const assignments = difference(keys, ['id']).map((key) => {
      return `${this.escapeId(key)} = ${this.escape(data[key], 'channel', key)}`
    }).join(', ')
    await this.query(`UPDATE ?? SET ${assignments} WHERE ?? = ?`, ['channel', 'id', data.id])
  },
})

export const name = 'mysql'

export function apply(ctx: Context, config: Config = {}) {
  const db = new MysqlDatabase(ctx.app, config)
  ctx.database = db
  ctx.before('connect', () => db.start())
  ctx.before('disconnect', () => db.stop())
}
