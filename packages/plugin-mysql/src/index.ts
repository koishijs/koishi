import MysqlDatabase, { Config, escape } from './database'
import { User, Channel, Database, Context, TableType, Tables as KoishiTables } from 'koishi-core'
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

export function createFilter<T extends TableType>(name: T, _query: KoishiTables.Query<T>) {
  const and = (_query: KoishiTables.Query<T>) => {
    const query = KoishiTables.resolveQuery(name, _query)
    const output: string[] = []
    for (const key in query) {
      if (key === '$or') {
        const value = query[key]
        output.push(`(${value.map(item => and(item)).join(' OR ')})`)
        continue
      }
      const value = query[key]
      const escapeKey = escapeId(key)
      function genQueryItem(val: typeof value, isNot: boolean = false): string {
        const notStr = isNot ? ' NOT' : ''
        if (Array.isArray(val)) {
          if (!val.length) return isNot ? '1' : '0'
          return `${escapeKey}${notStr} IN (${val.map(val => escape(val, name, key)).join(', ')})`
        }
        if (val instanceof RegExp) {
          const regexStr = val.toString()
          return `${escapeKey}${notStr} REGEXP '${regexStr.substring(1, regexStr.length - 1)}'`
        }
        return undefined
      }

      const queryItem = genQueryItem(value)
      if (queryItem) {
        output.push(queryItem)
        continue
      }
      ['$regex', '$in', '$nin'].filter(key => !!value[key]).forEach(key => {
        const queryItem = genQueryItem(value[key], key === '$nin')
        if (queryItem) output.push(queryItem)
      })
      output.push(
        ...Object.entries({
          $ne: '!=',
          $eq: '=',
          $gt: '>',
          $gte: '>=',
          $lt: '<',
          $lte: '<=',
        }).filter(([key, queryStr]) => !!value[key])
          .map(([key, queryStr]) => `${escapeKey} ${queryStr} ${value[key]}`),
      )
    }
    return output.join(' AND ')
  }
  return and(_query)
}

Database.extend(MysqlDatabase, {
  async get(name, query, fields) {
    const filter = createFilter(name, query)
    if (filter === '0') return []
    return this.select(name, fields, filter)
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

  async getUser(type, id, _fields) {
    const fields = _fields ? this.inferFields('user', _fields) : User.fields
    if (fields && !fields.length) return { [type]: id } as any
    if (Array.isArray(id)) {
      if (!id.length) return []
      const list = id.map(id => this.escape(id)).join(',')
      return this.select<User>('user', fields, `?? IN (${list})`, [type])
    }
    const [data] = await this.select<User>('user', fields, '?? = ?', [type, id])
    return data && { ...data, [type]: id }
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

  async getChannel(type, pid, fields) {
    if (Array.isArray(pid)) {
      if (fields && !fields.length) return pid.map(id => ({ id: `${type}:${id}` }))
      const placeholders = pid.map(() => '?').join(',')
      return this.select<Channel>('channel', fields, '`id` IN (' + placeholders + ')', pid.map(id => `${type}:${id}`))
    }
    if (fields && !fields.length) return { id: `${type}:${pid}` }
    const [data] = await this.select<Channel>('channel', fields, '`id` = ?', [`${type}:${pid}`])
    return data && { ...data, id: `${type}:${pid}` }
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
  ctx.database = db as any
  ctx.before('connect', () => db.start())
  ctx.before('disconnect', () => db.stop())
}
