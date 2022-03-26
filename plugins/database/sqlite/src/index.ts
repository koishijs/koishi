import { Context, Database, difference, Logger, makeArray, Model, Query, Schema, TableType, union } from 'koishi'
import { executeUpdate } from '@koishijs/orm-utils'
import { Builder, Caster } from '@koishijs/sql-utils'
import sqlite, { Statement } from 'better-sqlite3'
import { resolve } from 'path'
import { escapeId, format, escape as sqlEscape } from 'sqlstring-sqlite'
import { promises as fsp } from 'fs'

declare module 'koishi' {
  interface Database {
    sqlite: SQLiteDatabase
  }

  interface Modules {
    'database-sqlite': typeof import('.')
  }
}

const logger = new Logger('sqlite')

function getTypeDefinition({ type }: Model.Field) {
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

    this.caster = new Caster(ctx.model)
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

  private _getColDefs(table: string, key: string) {
    const config = this.ctx.model.config[table]
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
  private _syncTable(table: string) {
    const info = this.#exec('all', `PRAGMA table_info(${this.sql.escapeId(table)})`) as ISQLiteFieldInfo[]
    // FIXME: register platform columns before database initializion
    // WARN: side effecting Tables.config
    const config = this.ctx.model.config[table]
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

    for (const name in this.ctx.model.config) {
      this._syncTable(name)
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
    const tables = Object.keys(this.ctx.model.config)
    for (const table of tables) {
      this.#exec('run', `DROP TABLE ${this.sql.escapeId(table)}`)
    }
  }

  async stats() {
    if (this.#path === ':memory:') return {}
    const { size } = await fsp.stat(this.#path)
    return { size }
  }

  async remove(name: TableType, query: Query) {
    const filter = this.#query(name, query)
    if (filter === '0') return
    this.#exec('run', `DELETE FROM ${this.sql.escapeId(name)} WHERE ${filter}`)
  }

  #query(name: TableType, query: Query) {
    return this.sql.parseQuery(this.resolveQuery(name, query))
  }

  #get(name: TableType, query: Query, modifier: Query.Modifier) {
    const filter = this.#query(name, query)
    if (filter === '0') return []
    const { fields, limit, offset, sort } = this.resolveModifier(name, modifier)
    let sql = `SELECT ${this.#joinKeys(fields)} FROM ${this.sql.escapeId(name)} WHERE ${filter}`
    if (sort) sql += ' ORDER BY ' + Object.entries(sort).map(([key, order]) => `\`${key}\` ${order}`).join(', ')
    if (limit) sql += ' LIMIT ' + limit
    if (offset) sql += ' OFFSET ' + offset
    const rows = this.#exec('all', sql)
    return rows.map(row => this.caster.load(name, row))
  }

  async get(name: TableType, query: Query, modifier: Query.Modifier) {
    return this.#get(name, query, modifier)
  }

  #update(name: TableType, indexFields: string[], updateFields: string[], update: {}, data: {}) {
    const row = this.caster.dump(name, executeUpdate(data, update))
    const assignment = updateFields.map((key) => `\`${key}\` = ${this.sql.escape(row[key])}`).join(',')
    const query = Object.fromEntries(indexFields.map(key => [key, row[key]]))
    const filter = this.#query(name, query)
    this.#exec('run', `UPDATE ${this.sql.escapeId(name)} SET ${assignment} WHERE ${filter}`)
  }

  async set(name: TableType, query: Query, update: {}) {
    update = this.resolveUpdate(name, update)
    const { primary, fields } = this.resolveTable(name)
    const updateFields = [...new Set(Object.keys(update).map((key) => {
      return Object.keys(fields).find(field => field === key || key.startsWith(field + '.'))
    }))]
    const primaryFields = makeArray(primary)
    const table = this.#get(name, query, union(primaryFields, updateFields))
    for (const data of table) {
      this.#update(name, primaryFields, updateFields, update, data)
    }
  }

  #create(name: TableType, data: {}) {
    data = this.caster.dump(name, data)
    const keys = Object.keys(data)
    const sql = `INSERT INTO ${this.sql.escapeId(name)} (${this.#joinKeys(keys)}) VALUES (${keys.map(key => this.sql.escape(data[key])).join(', ')})`
    return this.#exec('run', sql)
  }

  async create<T extends TableType>(name: T, data: {}) {
    data = this.ctx.model.create(name, data)
    const result = this.#create(name, data)
    const { autoInc, primary } = this.resolveTable(name)
    if (!autoInc) return data as any
    return { ...data, [primary as string]: result.lastInsertRowid }
  }

  async upsert(name: TableType, updates: any[], keys: string | string[]) {
    if (!updates.length) return
    updates = updates.map(item => this.ctx.model.format(name, item))
    const { primary, fields } = this.resolveTable(name)
    const dataFields = [...new Set(Object.keys(Object.assign({}, ...updates)).map((key) => {
      return Object.keys(fields).find(field => field === key || key.startsWith(field + '.'))
    }))]
    const indexFields = makeArray(keys || primary)
    const relaventFields = union(indexFields, dataFields)
    const updateFields = difference(dataFields, indexFields)
    const table = this.#get(name, {
      $or: updates.map(item => Object.fromEntries(indexFields.map(key => [key, item[key]]))),
    }, relaventFields)
    for (const item of updates) {
      const data = table.find(row => indexFields.every(key => row[key] === item[key]))
      if (data) {
        this.#update(name, indexFields, updateFields, item, data)
      } else {
        this.#create(name, executeUpdate(this.ctx.model.create(name), item))
      }
    }
  }

  async eval(name: TableType, expr: any, query: Query) {
    const filter = this.#query(name, query)
    const output = this.sql.parseEval(expr)
    const { value } = this.#exec('get', `SELECT ${output} AS value FROM ${this.sql.escapeId(name)} WHERE ${filter}`)
    return value
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
