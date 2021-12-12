import { Database, makeArray, Logger, Schema, Context, Query, difference, Model, TableType } from 'koishi'
import { SQLBuilder, Caster } from '@koishijs/sql-utils'
import sqlite, { Statement } from 'better-sqlite3'
import { resolve } from 'path'
import { escape as sqlEscape, escapeId } from 'sqlstring-sqlite'

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
  sql: SQLBuilder
  caster: Caster

  constructor(public ctx: Context, public config: SQLiteDatabase.Config) {
    super(ctx)

    this.config = { path: '.koishi.db', ...config }

    this.sql = new class extends SQLBuilder {
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
    const info = this._exec('all', `PRAGMA table_info(${this.sql.escapeId(table)})`) as ISQLiteFieldInfo[]
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
          this._exec('run', `ALTER TABLE ${this.sql.escapeId(table)} ADD COLUMN ${def}`)
        } else {
          // Drop column
          this._exec('run', `ALTER TABLE ${this.sql.escapeId(table)} DROP COLUMN ${this.sql.escapeId(key)}`)
        }
      }
    } else {
      logger.info('auto creating table %c', table)
      const defs = keys.map(key => this._getColDefs(table, key))
      const constraints = []
      if (config.primary && !config.autoInc) {
        constraints.push(`PRIMARY KEY (${this._joinKeys(makeArray(config.primary))})`)
      }
      if (config.unique) {
        constraints.push(...config.unique.map(keys => `UNIQUE (${this._joinKeys(makeArray(keys))})`))
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
      this._exec('run', `CREATE TABLE ${this.sql.escapeId(table)} (${[...defs, ...constraints].join(',')})`)
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

  _joinKeys(keys?: string[]) {
    return keys ? keys.map(key => this.sql.escapeId(key)).join(',') : '*'
  }

  private _exec<K extends 'get' | 'run' | 'all'>(action: K, sql: string, params: any = []) {
    logger.debug('SQL > %c', sql)
    try {
      return this.db.prepare(sql)[action](params) as ReturnType<Statement[K]>
    } catch (e) {
      logger.warn('SQL Failed > %c', sql)
      throw e
    }
  }

  stop() {
    this.db.close()
  }

  async drop(name: TableType) {
    if (name) {
      this._exec('run', `DROP TABLE ${this.sql.escapeId(name)}`)
    } else {
      const tables = Object.keys(this.ctx.model.config)
      for (const table of tables) {
        this._exec('run', `DROP TABLE ${this.sql.escapeId(table)}`)
      }
    }
  }

  async get(name: TableType, query: Query, modifier: Query.Modifier) {
    const filter = this.sql.parseQuery(this.ctx.model.resolveQuery(name, query))
    if (filter === '0') return []
    const { fields, limit, offset } = Query.resolveModifier(modifier)
    let sql = `SELECT ${this._joinKeys(fields)} FROM ${this.sql.escapeId(name)} WHERE ${filter}`
    if (limit) sql += ' LIMIT ' + limit
    if (offset) sql += ' OFFSET ' + offset
    const rows = this._exec('all', sql)
    return rows.map(row => this.caster.load(name, row))
  }

  async set(name: TableType, query: Query, data: {}) {
    const filter = this.sql.parseQuery(this.ctx.model.resolveQuery(name, query))
    if (filter === '0') return
    data = this.caster.dump(name, data)
    const update = Object.keys(data).map((key) => {
      return `${this.sql.escapeId(key)} = ${this.sql.escape(data[key])}`
    }).join(', ')
    this._exec('run', `UPDATE ${this.sql.escapeId(name)} SET ${update} WHERE ${filter}`)
  }

  async remove(name: TableType, query: Query) {
    const filter = this.sql.parseQuery(this.ctx.model.resolveQuery(name, query))
    if (filter === '0') return
    this._exec('run', `DELETE FROM ${this.sql.escapeId(name)} WHERE ${filter}`)
  }

  async create(name: TableType, data: {}) {
    data = { ...this.ctx.model.create(name), ...data }
    const dbData = this.caster.dump(name, data)
    const keys = Object.keys(data)
    const sql = `INSERT INTO ${this.sql.escapeId(name)} (${this._joinKeys(keys)}) VALUES (${keys.map(key => this.sql.escape(dbData[key])).join(', ')})`
    const result = this._exec('run', sql)
    const config = this.ctx.model.config[name]
    if (config?.autoInc) {
      return { ...data, [config.primary as string]: result.lastInsertRowid } as any
    }
    return data as any
  }

  async upsert(name: TableType, data: any[], keys: string | string[]) {
    if (!data.length) return
    const { fields, primary } = this.ctx.model.config[name]
    const fallback = this.ctx.model.create(name)
    const initKeys = Object.keys(fields)
    keys = makeArray(keys || primary)
    for (const item of data) {
      const updateKeys = Object.keys(item)
      const dbItem = this.caster.dump(name, { ...fallback, ...item })
      const update = difference(updateKeys, keys).map((key) => `${this.sql.escapeId(key)} = ${this.sql.escape(dbItem[key])}`).join(',')
      this._exec('run', 
        `INSERT INTO ${this.sql.escapeId(name)} (${this._joinKeys(initKeys)})
        VALUES (${initKeys.map(key => this.sql.escape(dbItem[key])).join(', ')})
        ON CONFLICT DO UPDATE SET ${update}`,
      )
    }
  }

  async aggregate(name: TableType, fields: {}, query: Query) {
    const keys = Object.keys(fields)
    if (!keys.length) return {}

    const filter = this.sql.parseQuery(this.ctx.model.resolveQuery(name, query))
    const exprs = keys.map(key => `${this.sql.parseEval(fields[key])} AS ${this.sql.escapeId(key)}`).join(', ')
    return this._exec('get', `SELECT ${exprs} FROM ${this.sql.escapeId(name)} WHERE ${filter}`)
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
