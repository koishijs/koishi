import { Database, makeArray, Logger, Schema, Context, Query, Model, TableType, union, difference } from 'koishi'
import { executeUpdate } from '@koishijs/orm-utils'
import { Builder, Caster } from '@koishijs/sql-utils'
import sqlite, { Statement } from 'better-sqlite3'
import { resolve } from 'path'
import { escape as sqlEscape, escapeId, format } from 'sqlstring-sqlite'
import { stat } from 'fs/promises'

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
  // eslint-disable-next-line @typescript-eslint/naming-convention
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

    this.#path = this.config.path === ':memory:' ? this.config.path : resolve(ctx.app.options.baseDir, this.config.path)

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
      dump: value => +value,
      load: (value) => value === null ? null : new Date(value),
    })
  }

  private _getColDefs(table: string, key: string) {
    const config = this.ctx.model.config[table]
    const { initial, nullable = initial === undefined || initial === null } = config.fields[key]
    let def = this.sql.escapeId(key)
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
          this.#exec('run', `ALTER TABLE ${this.sql.escapeId(table)} DROP COLUMN ${this.sql.escapeId(key)}`)
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
              `FOREIGN KEY (${this.sql.escapeId(key)})
              REFERENCES ${this.sql.escapeId(table)} (${this.sql.escapeId(key2)})`,
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
    return keys ? keys.map(key => this.sql.escapeId(key)).join(',') : '*'
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
    const { size } = await stat(this.#path)
    return { size }
  }

  async remove(name: TableType, query: Query) {
    const filter = this.#query(name, query)
    if (filter === '0') return
    this.#exec('run', `DELETE FROM ${this.sql.escapeId(name)} WHERE ${filter}`)
  }

  #query(name: TableType, query: Query) {
    return this.sql.parseQuery(this.ctx.model.resolveQuery(name, query))
  }

  #get(name: TableType, query: Query, modifier: Query.Modifier) {
    const filter = this.#query(name, query)
    if (filter === '0') return []
    const { fields, limit, offset, sort } = Query.resolveModifier(modifier)
    let sql = `SELECT ${this.#joinKeys(fields)} FROM ${this.sql.escapeId(name)} WHERE ${filter}`
    if (limit) sql += ' LIMIT ' + limit
    if (offset) sql += ' OFFSET ' + offset
    if (sort) sql += ' ORDER BY ' + Object.entries(sort).map(([key, order]) => `${this.sql.escapeId(key)} ${order}`).join(', ')
    const rows = this.#exec('all', sql)
    return rows.map(row => this.caster.load(name, row))
  }

  async get(name: TableType, query: Query, modifier: Query.Modifier) {
    return this.#get(name, query, modifier)
  }

  #update(name: TableType, indexFields: string[], updateFields: string[], update: {}, data: {}) {
    const row = this.caster.dump(name, executeUpdate(data, update))
    const assignment = updateFields.map((key) => `${this.sql.escapeId(key)} = ${this.sql.escape(row[key])}`).join(',')
    const query = Object.fromEntries(indexFields.map(key => [key, row[key]]))
    const filter = this.#query(name, query)
    this.#exec('run', `UPDATE ${this.sql.escapeId(name)} SET ${assignment} WHERE ${filter}`)
  }

  async set(name: TableType, query: Query, update: {}) {
    const { primary } = this.ctx.model.config[name]
    const updateFields = [...new Set(Object.keys(update).map(key => key.split('.', 1)[0]))]
    const indexFields = makeArray(primary)
    const fields = union(indexFields, updateFields)
    const table = this.#get(name, query, fields)
    for (const data of table) {
      this.#update(name, indexFields, updateFields, update, data)
    }
  }

  #create(name: TableType, data: {}) {
    data = this.caster.dump(name, data)
    const keys = Object.keys(data)
    const sql = `INSERT INTO ${this.sql.escapeId(name)} (${this.#joinKeys(keys)}) VALUES (${keys.map(key => this.sql.escape(data[key])).join(', ')})`
    return this.#exec('run', sql)
  }

  async create(name: TableType, data: {}) {
    data = { ...this.ctx.model.create(name), ...data }
    const result = this.#create(name, data)
    const { autoInc, primary } = this.ctx.model.config[name]
    if (!autoInc) return data as any
    return { ...data, [primary as string]: result.lastInsertRowid }
  }

  async upsert(name: TableType, updates: any[], keys: string | string[]) {
    if (!updates.length) return
    const { primary } = this.ctx.model.config[name]
    const merged = Object.assign({}, ...updates)
    const dataFields = [...new Set(Object.keys(merged).map(key => key.split('.', 1)[0]))]
    const indexFields = makeArray(keys || primary)
    const fields = union(indexFields, dataFields)
    const updateFields = difference(dataFields, indexFields)
    const table = this.#get(name, {
      $or: updates.map(item => Object.fromEntries(indexFields.map(key => [key, item[key]]))),
    }, fields)
    for (const item of updates) {
      let data = table.find(row => indexFields.every(key => row[key] === item[key]))
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
