import MysqlDatabase, { Config } from './database'
import { Database, Context, Query, makeArray, difference, Schema } from 'koishi'
import { OkPacket } from 'mysql'
import * as Koishi from 'koishi'

export * from './database'
export default MysqlDatabase

declare module 'koishi' {
  interface Database {
    mysql: MysqlDatabase
  }

  interface Modules {
    'database-mysql': typeof import('.')
  }
}

Database.extend(MysqlDatabase, {
  async drop(name) {
    if (name) {
      await this.query(`DROP TABLE ${this.escapeId(name)}`)
    } else {
      const data = await this.select('information_schema.tables', ['TABLE_NAME'], 'TABLE_SCHEMA = ?', [this.config.database])
      if (!data.length) return
      await this.query(data.map(({ TABLE_NAME }) => `DROP TABLE ${this.escapeId(TABLE_NAME)}`).join('; '))
    }
  },

  async get(name, query, modifier) {
    const filter = this.sql.parseQuery(Query.resolve(name, query))
    if (filter === '0') return []
    const { fields, limit, offset } = Query.resolveModifier(modifier)
    const keys = this.joinKeys(this.inferFields(name, fields))
    let sql = `SELECT ${keys} FROM ${name} _${name} WHERE ${filter}`
    if (limit) sql += ' LIMIT ' + limit
    if (offset) sql += ' OFFSET ' + offset
    return this.query(sql)
  },

  async set(name, query, data) {
    const filter = this.sql.parseQuery(Query.resolve(name, query))
    if (filter === '0') return
    const keys = Object.keys(data)
    const update = keys.map((key) => {
      return `${this.escapeId(key)} = ${this.escape(data[key], name, key)}`
    }).join(', ')
    await this.query(`UPDATE ${name} SET ${update} WHERE ${filter}`)
  },

  async remove(name, query) {
    const filter = this.sql.parseQuery(Query.resolve(name, query))
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

  async upsert(name, data, keys: string | string[]) {
    if (!data.length) return
    const { fields, primary } = Koishi.Tables.config[name]
    const fallback = Koishi.Tables.create(name)
    const initKeys = Object.keys(fields)
    const updateKeys = Object.keys(data[0])
    data = data.map(item => ({ ...fallback, ...item }))
    keys = makeArray(keys || primary)
    const placeholder = `(${initKeys.map(() => '?').join(', ')})`
    const update = difference(updateKeys, keys).map((key) => {
      key = this.escapeId(key)
      return `${key} = VALUES(${key})`
    }).join(', ')
    await this.query(
      `INSERT INTO ${this.escapeId(name)} (${this.joinKeys(initKeys)}) VALUES ${data.map(() => placeholder).join(', ')}
      ON DUPLICATE KEY UPDATE ${update}`,
      [].concat(...data.map(data => this.formatValues(name, data, initKeys))),
    )
  },

  async aggregate(name, fields, query) {
    const keys = Object.keys(fields)
    if (!keys.length) return {}

    const filter = this.sql.parseQuery(Query.resolve(name, query))
    const exprs = keys.map(key => `${this.sql.parseEval(fields[key])} AS ${this.escapeId(key)}`).join(', ')
    const [data] = await this.query(`SELECT ${exprs} FROM ${name} WHERE ${filter}`)
    return data
  },
})

export const name = 'database-mysql'

export const schema: Schema<Config> = Schema.object({
  host: Schema.string('要连接到的主机名。').default('localhost'),
  port: Schema.number('要连接到的端口号。').default(3306),
  user: Schema.string('要使用的用户名。').default('root'),
  password: Schema.string('要使用的密码。'),
  database: Schema.string('要访问的数据库名。').default('koishi'),
}, true)

export function apply(ctx: Context, config: Config = {}) {
  config = Schema.validate(config, schema)
  ctx.database = new MysqlDatabase(ctx, config)
}
