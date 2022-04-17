import { Context, Database, difference, Logger, makeArray, Schema, Tables, union } from 'koishi'
import { Executable, Field, Query, Selection } from '@koishijs/orm'
import { Builder, Caster } from '@koishijs/sql-utils'
import sqlite, { Statement } from 'better-sqlite3'
import { resolve } from 'path'
import { escapeId, format, escape as sqlEscape } from 'sqlstring-sqlite'
import { promises as fsp } from 'fs'

declare module 'koishi' {
  interface Database {
    sqlite: SQLiteDatabase
  }
}

const logger = new Logger('sqlite')

function getTypeDefinition({ type }: Field) {
  switch (type) {
    case 'integer':
    case 'unsigned':
    case 'date':
    case 'time':
    case 'timestamp': return `INTEGER`
    case 'float':
    case 'double':
    case 'decimal': return `REAL`
    case 'char':
    case 'string':
    case 'text':
    case 'list':
    case 'json': return `TEXT`
  }
}

export interface ISQLiteFieldInfo {
  name: string
  type: string
  notnull: number
  dflt_value: string
  pk: boolean
}

class SQLiteDatabase extends Database {
  public db: sqlite.Database
  sqlite = this
  sql: Builder
  caster: Caster

  #path: string

  constructor(public ctx: Context, public config: SQLiteDatabase.Config) {
    super(ctx)

    this.#path = this.config.path === ':memory:' ? this.config.path : resolve(ctx.app.baseDir, this.config.path)

    this.sql = new class extends Builder {
      format = format

      escapeId = escapeId

      escape(value: any) {
        if (value instanceof Date) {
          return (+value) + ''
        }
        return sqlEscape(value)
      }

      protected createElementQuery(key: string, value: any) {
        return `(',' || ${key} || ',') LIKE '%,${this.escape(value)},%'`
      }
    }()

    this.caster = new Caster(this.models)
    this.caster.register<object, string>({
      types: ['json'],
      dump: value => JSON.stringify(value),
      load: (value, initial) => value ? JSON.parse(value) : initial,
    })
    this.caster.register<string[], string>({
      types: ['list'],
      dump: value => value.join(','),
      load: (value) => value ? value.split(',') : [],
    })
    this.caster.register<Date, number>({
      types: ['date', 'time', 'timestamp'],
      dump: value => value === null ? null : +value,
      load: (value) => value === null ? null : new Date(value),
    })
  }

  private _getColDefs(table: keyof Tables, key: string) {
    const config = this.model(table)
    const { initial, nullable = initial === undefined || initial === null } = config.fields[key]
    let def = `\`${key}\``
    if (key === config.primary && config.autoInc) {
      def += ' INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT'
    } else {
      const typedef = getTypeDefinition(config.fields[key])
      def += ' ' + typedef + (nullable ? ' ' : ' NOT ') + 'NULL'
      if (initial !== undefined && initial !== null) {
        def += ' DEFAULT ' + this.sql.escape(this.caster.dump(table, { [key]: initial })[key])
      }
    }
    return def
  }

  /** synchronize table schema */
  private _syncTable(table: keyof Tables) {
    const info = this.#exec('all', `PRAGMA table_info(${this.sql.escapeId(table)})`) as ISQLiteFieldInfo[]
    // FIXME: register platform columns before database initializion
    // WARN: side effecting Tables.config
    const config = this.model(table)
    if (table === 'user') {
      new Set(this.ctx.bots.map(bot => bot.platform)).forEach(platform => {
        config.fields[platform] = { type: 'string', length: 63 }
        config.unique.push(platform)
      })
    }
    const keys = Object.keys(config.fields)
    if (info.length) {
      logger.info('auto updating table %c', table)
      const allKeys = [...keys, ...info.map(row => row.name)]
      for (const key of allKeys) {
        if (keys.includes(key) && info.some(({ name }) => name === key)) continue
        if (keys.includes(key)) {
          // Add column
          const def = this._getColDefs(table, key)
          this.#exec('run', `ALTER TABLE ${this.sql.escapeId(table)} ADD COLUMN ${def}`)
        } else {
          // Drop column
          this.#exec('run', `ALTER TABLE ${this.sql.escapeId(table)} DROP COLUMN \`${key}\``)
        }
      }
    } else {
      logger.info('auto creating table %c', table)
      const defs = keys.map(key => this._getColDefs(table, key))
      const constraints = []
      if (config.primary && !config.autoInc) {
        constraints.push(`PRIMARY KEY (${this.#joinKeys(makeArray(config.primary))})`)
      }
      if (config.unique) {
        constraints.push(...config.unique.map(keys => `UNIQUE (${this.#joinKeys(makeArray(keys))})`))
      }
      if (config.foreign) {
        constraints.push(
          ...Object.entries(config.foreign)
            .map(([key, [table, key2]]) =>
              `FOREIGN KEY (\`${key}\`)
              REFERENCES ${this.sql.escapeId(table)} (\`${key2})\``,
            ),
        )
      }
      this.#exec('run', `CREATE TABLE ${this.sql.escapeId(table)} (${[...defs, ...constraints].join(',')})`)
    }
  }

  async start() {
    this.db = sqlite(this.config.path === ':memory:' ? this.config.path : resolve(this.config.path))
    this.db.function('regexp', (pattern, str) => +new RegExp(pattern).test(str))

    for (const name in this.models) {
      this._syncTable(name as keyof Tables)
    }

    this.ctx.on('model', (name) => {
      this._syncTable(name)
    })
  }

  #joinKeys(keys?: string[]) {
    return keys?.length ? keys.map(key => `\`${key}\``).join(',') : '*'
  }

  stop() {
    this.db.close()
  }

  #exec<K extends 'get' | 'run' | 'all'>(action: K, sql: string, params: any = []) {
    try {
      const result = this.db.prepare(sql)[action](params) as ReturnType<Statement[K]>
      logger.debug('SQL > %c', sql)
      return result
    } catch (e) {
      logger.warn('SQL > %c', sql)
      throw e
    }
  }

  async drop() {
    const tables = Object.keys(this.models)
    for (const table of tables) {
      this.#exec('run', `DROP TABLE ${this.sql.escapeId(table)}`)
    }
  }

  async stats() {
    if (this.#path === ':memory:') return {}
    const { size } = await fsp.stat(this.#path)
    return { size }
  }

  async remove(name: keyof Tables, query: Query) {
    const sel = this.select(name, query)
    const filter = this.sql.parseQuery(sel.query)
    if (filter === '0') return
    this.#exec('run', `DELETE FROM ${this.sql.escapeId(name)} WHERE ${filter}`)
  }

  async execute(sel: Executable) {
    const { table, fields, expr } = sel
    const filter = this.sql.parseQuery(sel.query)
    if (expr) {
      const output = this.sql.parseEval(expr)
      const { value } = this.#exec('get', `SELECT ${output} AS value FROM ${this.sql.escapeId(table)} WHERE ${filter}`)
      return value
    } else {
      if (filter === '0') return []
      const { limit, offset, sort } = sel.modifier
      let sql = `SELECT ${this.#joinKeys(fields ? Object.keys(fields) : null)} FROM ${this.sql.escapeId(table)} WHERE ${filter}`
      if (sort.length) sql += ' ORDER BY ' + sort.map(([key, order]) => `\`${key['$'][1]}\` ${order}`).join(', ')
      if (limit < Infinity) sql += ' LIMIT ' + limit
      if (offset > 0) sql += ' OFFSET ' + offset
      const rows = this.#exec('all', sql)
      return rows.map(row => this.caster.load(table, row))
    }
  }

  #update(sel: Selection, indexFields: string[], updateFields: string[], update: {}, data: {}) {
    const row = this.caster.dump(sel.table, sel.update(data, update))
    const assignment = updateFields.map((key) => `\`${key}\` = ${this.sql.escape(row[key])}`).join(',')
    const query = Object.fromEntries(indexFields.map(key => [key, row[key]]))
    const filter = this.sql.parseQuery(query)
    this.#exec('run', `UPDATE ${this.sql.escapeId(sel.table)} SET ${assignment} WHERE ${filter}`)
  }

  async set(name: keyof Tables, query: Query, update: {}) {
    const sel = this.select(name, query)
    update = sel.resolveUpdate(update)
    const { primary, fields } = sel.model
    const updateFields = [...new Set(Object.keys(update).map((key) => {
      return Object.keys(fields).find(field => field === key || key.startsWith(field + '.'))
    }))]
    const primaryFields = makeArray(primary)
    const table = await this.get(name, query, union(primaryFields, updateFields) as [])
    for (const data of table) {
      this.#update(sel, primaryFields, updateFields, update, data)
    }
  }

  #create(name: keyof Tables, data: {}) {
    data = this.caster.dump(name, data)
    const keys = Object.keys(data)
    const sql = `INSERT INTO ${this.sql.escapeId(name)} (${this.#joinKeys(keys)}) VALUES (${keys.map(key => this.sql.escape(data[key])).join(', ')})`
    return this.#exec('run', sql)
  }

  async create<T extends keyof Tables>(name: T, data: {}) {
    const model = this.model(name)
    data = model.create(data)
    const result = this.#create(name, data)
    const { autoInc, primary } = model
    if (!autoInc) return data as any
    return { ...data, [primary as string]: result.lastInsertRowid }
  }

  async upsert(name: keyof Tables, data: any[], keys: string | string[]) {
    if (!data.length) return
    const sel = this.select(name)
    data = sel.resolveUpsert(data)
    const { primary, fields } = sel.model
    const dataFields = [...new Set(Object.keys(Object.assign({}, ...data)).map((key) => {
      return Object.keys(fields).find(field => field === key || key.startsWith(field + '.'))
    }))]
    const indexFields = makeArray(keys || primary)
    const relaventFields = union(indexFields, dataFields)
    const updateFields = difference(dataFields, indexFields)
    const table = await this.get(name, {
      $or: data.map(item => Object.fromEntries(indexFields.map(key => [key, item[key]]))),
    }, relaventFields as [])
    for (const item of data) {
      const data = table.find(row => indexFields.every(key => row[key] === item[key]))
      if (data) {
        this.#update(sel, indexFields, updateFields, item, data)
      } else {
        this.#create(name, sel.update(sel.model.create(), item))
      }
    }
  }
}

namespace SQLiteDatabase {
  export interface Config {
    path?: string
  }

  export const Config = Schema.object({
    path: Schema.string().description('数据库路径').default('.koishi.db'),
  })
}

export default SQLiteDatabase
