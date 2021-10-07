import SqliteDatabase, { Config } from './database'
import { Database, Context, Query, makeArray, difference, Schema } from 'koishi'
import { escapeId, escape, parseEval, parseQuery } from './utils'
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
    this.run(`UPDATE ${escapeId(name)} SET ${update} WHERE ${filter}`)
  },

  async remove(name, query) {
    const filter = parseQuery(Query.resolve(name, query))
    if (filter === '0') return
    this.run(`DELETE FROM ${escapeId(name)} WHERE ${filter}`)
  },

  async create(name, data) {
    const adapter = this._getDbAdapter(name)
    data = { ...Koishi.Tables.create(name), ...data }
    const dbData = adapter.localToDb(data)
    const keys = Object.keys(data)
    try {
      const result = this.run(
      `INSERT INTO ${escapeId(name)} (${this._joinKeys(keys)}) VALUES (${keys.map(key => escape(dbData[key])).join(', ')})`,
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
    const adapter = this._getDbAdapter(name)
    keys = makeArray(keys || primary)
    for (const item of data) {
      const updateKeys = Object.keys(item)
      const dbItem = adapter.localToDb({ ...fallback, ...item })
      const update = difference(updateKeys, keys).map((key) => `${escapeId(key)} = ${escape(dbItem[key])}`).join(',')
      this.run(
        `INSERT INTO ${escapeId(name)} (${this._joinKeys(initKeys)})
        VALUES (${initKeys.map(key => escape(dbItem[key])).join(', ')})
        ON CONFLICT DO UPDATE SET ${update}`,
      )
    }
  },

  async aggregate(name, fields, query) {
    const keys = Object.keys(fields)
    if (!keys.length) return {}

    const filter = parseQuery(Query.resolve(name, query))
    const exprs = keys.map(key => `${parseEval(fields[key])} AS ${escapeId(key)}`).join(', ')
    const data = await this.get(`SELECT ${exprs} FROM ${escapeId(name)} WHERE ${filter}`)
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
