import MysqlDatabase, { Config, escape, TableType } from './database'
import { User, Channel, Database, Context, Query } from 'koishi-core'
import { difference } from 'koishi-utils'
import { OkPacket, escapeId } from 'mysql'

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

function createEqualQuery(key: string, value: any) {
  return `${key} = ${escape(value)}`
}

const queryOperators: Record<string, (key: string, value: any) => string> = {
  $regex: createRegExpQuery,
  $regexFor: (key, value) => `${escape(value)} REGEXP ${key}`,
  $in: (key, value) => createMemberQuery(key, value, ''),
  $nin: (key, value) => createMemberQuery(key, value, ' NOT'),
  $eq: createEqualQuery,
  $ne: (key, value) => `${key} != ${escape(value)}`,
  $gt: (key, value) => `${key} > ${escape(value)}`,
  $gte: (key, value) => `${key} >= ${escape(value)}`,
  $lt: (key, value) => `${key} < ${escape(value)}`,
  $lte: (key, value) => `${key} <= ${escape(value)}`,
}

export function createFilter<T extends TableType>(name: T, query: Query<T>) {
  function parseQuery(query: Query.Expr) {
    const conditions: string[] = []
    for (const key in query) {
      // logical expression
      if (key === '$or') {
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
    const { select, limit, offset } = Query.resolveModifier(modifier)
    const fields = this.joinKeys(this.inferFields(name, select))
    let sql = `SELECT ${fields} FROM ${name} WHERE ${filter}`
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
    const keys = Object.keys(data)
    if (!keys.length) return
    const header = await this.query<OkPacket>(
      `INSERT INTO ?? (${this.joinKeys(keys)}) VALUES (${keys.map(() => '?').join(', ')})`,
      [table, ...this.formatValues(table, data, keys)],
    )
    return { ...data, id: header.insertId } as any
  },

  async update(table, data) {
    if (!data.length) return
    const keys = Object.keys(data[0])
    const placeholder = `(${keys.map(() => '?').join(', ')})`
    await this.query(
      `INSERT INTO ?? (${this.joinKeys(keys)}) VALUES ${data.map(() => placeholder).join(', ')}
      ON DUPLICATE KEY UPDATE ${keys.filter(key => key !== 'id').map(key => `\`${key}\` = VALUES(\`${key}\`)`).join(', ')}`,
      [table, ...[].concat(...data.map(data => this.formatValues(table, data, keys)))],
    )
  },

  async getUser(type, id, modifier) {
    const { select } = Query.resolveModifier(modifier)
    if (select && !select.length) {
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
    const { select } = Query.resolveModifier(modifier)
    if (select && !select.length) {
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

Database.extend(MysqlDatabase, ({ tables, Domain }) => {
  tables.user = {
    id: new Domain.String(`bigint(20) unsigned not null auto_increment`),
    name: `varchar(50) null default null collate 'utf8mb4_general_ci'`,
    flag: `bigint(20) unsigned not null default '0'`,
    authority: `tinyint(4) unsigned not null default '0'`,
    usage: new Domain.Json(),
    timers: new Domain.Json(),
  }

  tables.channel = {
    id: `varchar(50) not null`,
    flag: `bigint(20) unsigned not null default '0'`,
    assignee: `varchar(50) null`,
    disable: new Domain.Array(),
  }
})

export const name = 'mysql'

export function apply(ctx: Context, config: Config = {}) {
  const db = new MysqlDatabase(ctx.app, config)
  ctx.database = db
  ctx.before('connect', () => db.start())
  ctx.before('disconnect', () => db.stop())
}
