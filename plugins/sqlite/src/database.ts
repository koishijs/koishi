import { App, Database, makeArray, Tables, Logger } from 'koishi'
import sqlite from 'better-sqlite3'
import { resolve } from 'path'
import { SQLHelper, Caster } from '@koishijs/sql-utils'
import { escape as sqlEscape, escapeId } from 'sqlstring-sqlite'

const logger = new Logger('sqlite')

export type TableType = keyof Tables

export interface Config {
  path?: string
}

function getTypeDefinition({ type }: Tables.Field) {
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
  sql: SQLHelper
  caster: Caster

  constructor(public app: App, public config: Config) {
    super(app)

    this.sql = new class extends SQLHelper {
      escapeId = escapeId
      escape(value: any, stringifyObjects?: boolean, timeZone?: string) {
        if (value instanceof Date) {
          return (+value) + ''
        }
        return sqlEscape(value, stringifyObjects, timeZone)
      }

      protected createElementQuery = (key: string, value: any) => {
        return `(',' || ${key} || ',') LIKE '%,${this.escape(value)},%'`
      }
    }()

    this.caster = new Caster()
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

  private getColumnDefinitionSQL(table: string, key: string) {
    const config = Tables.config[table]
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

  private syncTable(table: string) {
    const info = this._getTableInfo(table)
    // FIXME: register platform columns before database initializion
    // WARN: side effecting Tables.config
    const config = Tables.config[table]
    if (table === 'user') {
      new Set(this.app.bots.map(bot => bot.platform)).forEach(platform => {
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
          const def = this.getColumnDefinitionSQL(table, key)
          this.run(`ALTER TABLE ${this.sql.escapeId(table)} ADD COLUMN ${def}`)
        } else {
          // Drop column
          this.run(`ALTER TABLE ${this.sql.escapeId(table)} DROP COLUMN ${this.sql.escapeId(key)}`)
        }
      }
    } else {
      logger.info('auto creating table %c', table)
      const defs = keys.map(key => this.getColumnDefinitionSQL(table, key))
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
      this.run(`CREATE TABLE ${this.sql.escapeId(table)} (${[...defs, ...constraints].join(',')})`)
    }
  }

  async start() {
    this.db = sqlite(this.config.path === ':memory:' ? this.config.path : resolve(this.config.path))
    this.db.function('regexp', (pattern, str) => +new RegExp(pattern).test(str))
    // Synchronize database schemas
    for (const name in Tables.config) {
      this.syncTable(name)
    }
  }

  _joinKeys(keys?: string[]) {
    return keys ? keys.map(key => this.sql.escapeId(key)).join(',') : '*'
  }

  run(sql: string, params: any = []) {
    logger.debug('SQL > %c', sql)
    try {
      return this.db.prepare(sql).run(params)
    } catch (e) {
      logger.warn('SQL Failed > %c', sql)
      throw e
    }
  }

  get(sql: string, params: any = []) {
    logger.debug('SQL > %c', sql)
    try {
      return this.db.prepare(sql).get(params)
    } catch (e) {
      logger.warn('SQL Failed > %c', sql)
      throw e
    }
  }

  all(sql: string, params: any = []) {
    logger.debug('SQL > %c', sql)
    try {
      return this.db.prepare(sql).all(params)
    } catch (e) {
      logger.warn('SQL Failed > %c', sql)
      throw e
    }
  }

  _getTables(): string[] {
    const rows = this.all(`SELECT name FROM sqlite_master WHERE type='table'`)
    return rows.map(({ name }) => name)
  }

  _getTableInfo(table: string): ISQLiteFieldInfo[] {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    return this.all(`PRAGMA table_info(${this.sql.escapeId(table)})`)
  }

  stop() {
    this.db.close()
  }
}

export default SQLiteDatabase
