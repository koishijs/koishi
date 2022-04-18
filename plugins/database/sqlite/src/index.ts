import { Context, difference, Eval, Logger, makeArray, Schema, Tables, union } from 'koishi'
import { Driver, Executable, executeUpdate, Field, Modifier } from '@koishijs/orm'
import { Builder, Caster } from '@koishijs/sql-utils'
import sqlite, { Statement } from 'better-sqlite3'
import { resolve } from 'path'
import { escapeId, format, escape as sqlEscape } from 'sqlstring-sqlite'
import { promises as fsp } from 'fs'

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

class SQLiteDriver extends Driver {
  public db: sqlite.Database
  sqlite = this
  sql: Builder
  caster: Caster
  #path: string

  constructor(public ctx: Context, public config: SQLiteDriver.Config) {
    super(ctx.model, 'sqlite')
    ctx.on('ready', () => this.start())
    ctx.on('dispose', () => this.stop())

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

    this.caster = new Caster(this.database.tables)
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
  prepare(table: keyof Tables) {
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
    super.start()
  }

  #joinKeys(keys?: string[]) {
    return keys?.length ? keys.map(key => `\`${key}\``).join(',') : '*'
  }

  async stop() {
    super.stop()
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
    const tables = Object.keys(this.database.tables)
    for (const table of tables) {
      this.#exec('run', `DROP TABLE ${this.sql.escapeId(table)}`)
    }
  }

  async stats() {
    if (this.#path === ':memory:') return {}
    const { size } = await fsp.stat(this.#path)
    return { size }
  }

  async remove(sel: Executable) {
    const { query, table } = sel
    const filter = this.sql.parseQuery(query)
    if (filter === '0') return
    this.#exec('run', `DELETE FROM ${this.sql.escapeId(table)} WHERE ${filter}`)
  }

  async get(sel: Executable, modifier: Modifier) {
    const { table, fields, query } = sel
    const filter = this.sql.parseQuery(query)
    if (filter === '0') return []
    const { limit, offset, sort } = modifier
    let sql = `SELECT ${this.#joinKeys(fields ? Object.keys(fields) : null)} FROM ${this.sql.escapeId(table)} WHERE ${filter}`
    if (sort.length) sql += ' ORDER BY ' + sort.map(([key, order]) => `\`${key['$'][1]}\` ${order}`).join(', ')
    if (limit < Infinity) sql += ' LIMIT ' + limit
    if (offset > 0) sql += ' OFFSET ' + offset
    const rows = this.#exec('all', sql)
    return rows.map(row => this.caster.load(table, row))
  }

  async eval(sel: Executable, expr: Eval.Expr) {
    const { table, query } = sel
    const filter = this.sql.parseQuery(query)
    const output = this.sql.parseEval(expr)
    const { value } = this.#exec('get', `SELECT ${output} AS value FROM ${this.sql.escapeId(table)} WHERE ${filter}`)
    return value
  }

  #update(sel: Executable, indexFields: string[], updateFields: string[], update: {}, data: {}) {
    const { ref, table } = sel
    const row = this.caster.dump(table, executeUpdate(data, update, ref))
    const assignment = updateFields.map((key) => `\`${key}\` = ${this.sql.escape(row[key])}`).join(',')
    const query = Object.fromEntries(indexFields.map(key => [key, row[key]]))
    const filter = this.sql.parseQuery(query)
    this.#exec('run', `UPDATE ${this.sql.escapeId(table)} SET ${assignment} WHERE ${filter}`)
  }

  async set(sel: Executable, update: {}) {
    const { model, table, query } = sel
    const { primary, fields } = model
    const updateFields = [...new Set(Object.keys(update).map((key) => {
      return Object.keys(fields).find(field => field === key || key.startsWith(field + '.'))
    }))]
    const primaryFields = makeArray(primary)
    const data = await this.database.get(table, query, union(primaryFields, updateFields) as [])
    for (const row of data) {
      this.#update(sel, primaryFields, updateFields, update, row)
    }
  }

  #create(table: string, data: {}) {
    data = this.caster.dump(table, data)
    const keys = Object.keys(data)
    const sql = `INSERT INTO ${this.sql.escapeId(table)} (${this.#joinKeys(keys)}) VALUES (${keys.map(key => this.sql.escape(data[key])).join(', ')})`
    return this.#exec('run', sql)
  }

  async create(sel: Executable, data: {}) {
    const { model, table } = sel
    data = model.create(data)
    const result = this.#create(table, data)
    const { autoInc, primary } = model
    if (!autoInc) return data as any
    return { ...data, [primary as string]: result.lastInsertRowid }
  }

  async upsert(sel: Executable, data: any[], keys: string[]) {
    if (!data.length) return
    const { model, table, ref } = sel
    const dataFields = [...new Set(Object.keys(Object.assign({}, ...data)).map((key) => {
      return Object.keys(model.fields).find(field => field === key || key.startsWith(field + '.'))
    }))]
    const relaventFields = union(keys, dataFields)
    const updateFields = difference(dataFields, keys)
    const results = await this.database.get(table, {
      $or: data.map(item => Object.fromEntries(keys.map(key => [key, item[key]]))),
    }, relaventFields as [])
    for (const item of data) {
      const row = results.find(row => keys.every(key => row[key] === item[key]))
      if (row) {
        this.#update(sel, keys, updateFields, item, row)
      } else {
        this.#create(table, executeUpdate(model.create(), item, ref))
      }
    }
  }
}

namespace SQLiteDriver {
  export interface Config {
    path?: string
  }

  export const Config = Schema.object({
    path: Schema.string().description('数据库路径').default('.koishi.db'),
  })
}

export default SQLiteDriver
