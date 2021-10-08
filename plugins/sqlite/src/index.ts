import SqliteDatabase, { Config } from './database'
import { Database, Context, Query, makeArray, difference, Schema } from 'koishi'
import { utils } from './utils'
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

Database.extend(SqliteDatabase, {
  async drop(name) {
    if (name) {
      this.run(`DROP TABLE ${utils.escapeId(name)}`)
      delete this.dbAdapters[name]
    } else {
      const tables = Object.keys(Koishi.Tables.config)
      for (const table of tables) {
        this.run(`DROP TABLE ${utils.escapeId(table)}`)
      }
      this.dbAdapters = Object.create(null)
    }
  },

  async get(name, query, modifier) {
    const filter = utils.parseQuery(Query.resolve(name, query))
    if (filter === '0') return []
    const { fields, limit, offset } = Query.resolveModifier(modifier)
    let sql = `SELECT ${this._joinKeys(fields)} FROM ${utils.escapeId(name)} WHERE ${filter}`
    if (limit) sql += ' LIMIT ' + limit
    if (offset) sql += ' OFFSET ' + offset
    const rows = this.all(sql)
    const adapter = this.dbAdapters[name]
    return rows.map(row => adapter.dbToLocal(row))
  },

  async set(name, query, data) {
    const filter = utils.parseQuery(Query.resolve(name, query))
    if (filter === '0') return
    const adapter = this.dbAdapters[name]
    data = adapter.localToDb(data)
    const update = Object.keys(data).map((key) => {
      return `${utils.escapeId(key)} = ${utils.escape(data[key])}`
    }).join(', ')
    this.run(`UPDATE ${utils.escapeId(name)} SET ${update} WHERE ${filter}`)
  },

  async remove(name, query) {
    const filter = utils.parseQuery(Query.resolve(name, query))
    if (filter === '0') return
    this.run(`DELETE FROM ${utils.escapeId(name)} WHERE ${filter}`)
  },

  async create(name, data) {
    const adapter = this.dbAdapters[name]
    data = { ...Koishi.Tables.create(name), ...data }
    const dbData = adapter.localToDb(data)
    const keys = Object.keys(data)
    try {
      const result = this.run(
      `INSERT INTO ${utils.escapeId(name)} (${this._joinKeys(keys)}) VALUES (${keys.map(key => utils.escape(dbData[key])).join(', ')})`,
      )
      const config = Koishi.Tables.config[name]
      if (config?.autoInc) {
        return { ...data, [config.primary as string]: result.lastInsertRowid } as any
      }
      return data as any
    } catch {}
  },

  async upsert(name, data, keys: string | string[]) {
    if (!data.length) return
    const { fields, primary } = Koishi.Tables.config[name]
    const fallback = Koishi.Tables.create(name)
    const initKeys = Object.keys(fields)
    const adapter = this.dbAdapters[name]
    keys = makeArray(keys || primary)
    for (const item of data) {
      const updateKeys = Object.keys(item)
      const dbItem = adapter.localToDb({ ...fallback, ...item })
      const update = difference(updateKeys, keys).map((key) => `${utils.escapeId(key)} = ${utils.escape(dbItem[key])}`).join(',')
      this.run(
        `INSERT INTO ${utils.escapeId(name)} (${this._joinKeys(initKeys)})
        VALUES (${initKeys.map(key => utils.escape(dbItem[key])).join(', ')})
        ON CONFLICT DO UPDATE SET ${update}`,
      )
    }
  },

  async aggregate(name, fields, query) {
    const keys = Object.keys(fields)
    if (!keys.length) return {}

    const filter = utils.parseQuery(Query.resolve(name, query))
    const exprs = keys.map(key => `${utils.parseEval(fields[key])} AS ${utils.escapeId(key)}`).join(', ')
    const data = await this.get(`SELECT ${exprs} FROM ${utils.escapeId(name)} WHERE ${filter}`)
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
