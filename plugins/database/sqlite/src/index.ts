import SQLiteDatabase, { Config } from './database'
import { Database, Context, Query, makeArray, difference, Schema } from 'koishi'
import * as Koishi from 'koishi'

export * from './database'
export default SQLiteDatabase

declare module 'koishi' {
  interface Database {
    sqlite: SQLiteDatabase
  }

  interface Modules {
    'database-sqlite': typeof import('.')
  }
}

Database.extend(SQLiteDatabase, {
  async drop(name) {
    if (name) {
      this.run(`DROP TABLE ${this.sql.escapeId(name)}`)
    } else {
      const tables = Object.keys(Koishi.Tables.config)
      for (const table of tables) {
        this.run(`DROP TABLE ${this.sql.escapeId(table)}`)
      }
    }
  },

  async get(name, query, modifier) {
    const filter = this.sql.parseQuery(Query.resolve(name, query))
    if (filter === '0') return []
    const { fields, limit, offset } = Query.resolveModifier(modifier)
    let sql = `SELECT ${this._joinKeys(fields)} FROM ${this.sql.escapeId(name)} WHERE ${filter}`
    if (limit) sql += ' LIMIT ' + limit
    if (offset) sql += ' OFFSET ' + offset
    const rows = this.all(sql)
    return rows.map(row => this.caster.load(name, row))
  },

  async set(name, query, data) {
    const filter = this.sql.parseQuery(Query.resolve(name, query))
    if (filter === '0') return
    data = this.caster.dump(name, data)
    const update = Object.keys(data).map((key) => {
      return `${this.sql.escapeId(key)} = ${this.sql.escape(data[key])}`
    }).join(', ')
    this.run(`UPDATE ${this.sql.escapeId(name)} SET ${update} WHERE ${filter}`)
  },

  async remove(name, query) {
    const filter = this.sql.parseQuery(Query.resolve(name, query))
    if (filter === '0') return
    this.run(`DELETE FROM ${this.sql.escapeId(name)} WHERE ${filter}`)
  },

  async create(name, data) {
    data = { ...Koishi.Tables.create(name), ...data }
    const dbData = this.caster.dump(name, data)
    const keys = Object.keys(data)
    try {
      const result = this.run(
      `INSERT INTO ${this.sql.escapeId(name)} (${this._joinKeys(keys)}) VALUES (${keys.map(key => this.sql.escape(dbData[key])).join(', ')})`,
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
    keys = makeArray(keys || primary)
    for (const item of data) {
      const updateKeys = Object.keys(item)
      const dbItem = this.caster.dump(name, { ...fallback, ...item })
      const update = difference(updateKeys, keys).map((key) => `${this.sql.escapeId(key)} = ${this.sql.escape(dbItem[key])}`).join(',')
      this.run(
        `INSERT INTO ${this.sql.escapeId(name)} (${this._joinKeys(initKeys)})
        VALUES (${initKeys.map(key => this.sql.escape(dbItem[key])).join(', ')})
        ON CONFLICT DO UPDATE SET ${update}`,
      )
    }
  },

  async aggregate(name, fields, query) {
    const keys = Object.keys(fields)
    if (!keys.length) return {}

    const filter = this.sql.parseQuery(Query.resolve(name, query))
    const exprs = keys.map(key => `${this.sql.parseEval(fields[key])} AS ${this.sql.escapeId(key)}`).join(', ')
    const data = await this.get(`SELECT ${exprs} FROM ${this.sql.escapeId(name)} WHERE ${filter}`)
    return data
  },
})

export const name = 'database-sqlite'

export const schema: Schema<Config> = Schema.object({
  path: Schema.string('数据库路径').default('.koishi.db'),
}, true)

export function apply(ctx: Context, config: Config = {}) {
  config = Schema.validate(config, schema)
  ctx.database = new SQLiteDatabase(ctx.app, config)
}
