import { App, clone, Database, makeArray, Tables } from 'koishi'
import sqlite from 'better-sqlite3'
import { resolve } from 'path'
import { utils, logger } from './utils'

export type TableType = keyof Tables

export interface Config {
  path?: string
}

export namespace DbAdapter {
  interface FieldAdapter<S = any, T = any> {
    match: Tables.Field.Type<S>[]
    localToDb: (value: S) => T
    dbToLocal: (value: T, initial?: S) => S
  }
  const fieldAdapters: FieldAdapter[] = []
  function defineFieldConverter<S, T>(converter: FieldAdapter<S, T>) {
    fieldAdapters.push(converter)
  }

  defineFieldConverter<object, string>({
    match: ['json'],
    localToDb: value => JSON.stringify(value),
    dbToLocal: (value, initial) => value ? JSON.parse(value) : initial,
  })
  defineFieldConverter<string[], string>({
    match: ['list'],
    localToDb: value => value.join(','),
    dbToLocal: (value) => value ? value.split(',') : [],
  })
  defineFieldConverter<Date, number>({
    match: ['date', 'time', 'timestamp'],
    localToDb: value => +value,
    dbToLocal: (value) => value === null ? null : new Date(value),
  })

  export interface TableAdapter {
    localToDb(obj: any): any
    dbToLocal(obj: any): any
  }

  function createStubTableAdapter(): TableAdapter {
    return {
      localToDb: obj => obj,
      dbToLocal: obj => obj,
    }
  }

  export function createTableAdapter(table: string): TableAdapter {
    const config = Tables.config[table]
    if (!config) throw new Error(`table ${table} not found`)
    const fields = Object.keys(config.fields)
    const targets = fieldAdapters
      .map(converter =>
        [
          converter,
          fields.filter(field => converter.match.includes(config.fields[field].type)),
        ] as const,
      )
      .filter(([, fields]) => fields.length)
    if (!targets.length) return createStubTableAdapter()
    return {
      localToDb: obj => {
        const result = clone(obj)
        targets.forEach(([converter, fields]) =>
          fields.filter(field => field in obj).forEach(field => result[field] = converter.localToDb(obj[field])),
        )
        return result
      },
      dbToLocal: obj => {
        const result = clone(obj)
        targets.forEach(([converter, fields]) =>
          fields.filter(field => field in obj).forEach(field => result[field] = converter.dbToLocal(obj[field], config.fields[field].initial)),
        )
        return result
      },
    }
  }
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

function getColumnDefinitionSQL(table: string, key: string, adapter: DbAdapter.TableAdapter) {
  const config = Tables.config[table]
  const { initial, nullable = initial === undefined || initial === null } = config.fields[key]
  let def = utils.escapeId(key)
  if (key === config.primary && config.autoInc) {
    def += ' INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT'
  } else {
    const typedef = getTypeDefinition(config.fields[key])
    def += ' ' + typedef + (nullable ? ' ' : ' NOT ') + 'NULL'
    if (initial !== undefined && initial !== null) {
      def += ' DEFAULT ' + utils.escape(adapter.localToDb({ [key]: initial })[key])
    }
  }
  return def
}

class SqliteDatabase extends Database {
  public db: sqlite.Database

  sqlite = this

  #dbAdapters: Record<string, DbAdapter.TableAdapter>

  constructor(public app: App, public config: Config) {
    super(app)
    this.#dbAdapters = Object.create(null)
  }

  async #syncTable(table: string) {
    const adapter = DbAdapter.createTableAdapter(table)
    this.#dbAdapters[table] = adapter

    const info = await this._getTableInfo(table)
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
          const def = getColumnDefinitionSQL(table, key, adapter)
          await this.run(`ALTER TABLE ${utils.escapeId(table)} ADD COLUMN ${def}`)
        } else {
          // Drop column
          await this.run(`ALTER TABLE ${utils.escapeId(table)} DROP COLUMN ${utils.escapeId(key)}`)
        }
      }
    } else {
      logger.info('auto creating table %c', table)
      const defs = keys.map(key => getColumnDefinitionSQL(table, key, adapter))
      const constraints = []
      if (config.primary && !config.autoInc) {
        constraints.push(`PRIMARY KEY (${this._joinKeys(config.primary)})`)
      }
      if (config.unique) {
        constraints.push(...config.unique.map(keys => `UNIQUE (${this._joinKeys(keys)})`))
      }
      if (config.foreign) {
        constraints.push(
          ...Object.entries(config.foreign)
            .map(([key, [table, key2]]) => `FOREIGN KEY (${utils.escapeId(key)}) REFERENCES ${utils.escapeId(table)} (${utils.escapeId(key2)})`),
        )
      }
      await this.run(`CREATE TABLE ${utils.escapeId(table)} (${[...defs, ...constraints].join(',')})`)
    }
  }

  async start() {
    this.db = sqlite(this.config.path === ':memory:' ? this.config.path : resolve(this.config.path))
    this.db.function('regexp', (pattern, str) => +new RegExp(pattern).test(str))
    // Synchronize database schemas
    for (const name in Tables.config) {
      await this.#syncTable(name)
    }
  }

  _joinKeys(keys?: string | string[]) {
    return keys ? makeArray(keys).map(key => utils.escapeId(key)).join(',') : '*'
  }

  run(sql: string, params: any = []) {
    logger.debug('SQL > %c', sql)
    return this.db.prepare(sql).run(params)
  }

  get(sql: string, params: any = []) {
    logger.debug('SQL > %c', sql)
    return this.db.prepare(sql).get(params)
  }

  all(sql: string, params: any = []) {
    logger.debug('SQL > %c', sql)
    return this.db.prepare(sql).all(params)
  }

  async count<K extends TableType>(table: K, where?: string) {
    const [{ 'COUNT(*)': count }] = await this.get(`SELECT COUNT(*) FROM ${utils.escapeId(table)} ${where ? 'WHERE ' + where : ''}`)
    return count as number
  }

  _getDbAdapter(table: string) {
    return this.#dbAdapters[table]
  }

  async _getTables(): Promise<string[]> {
    const rows = await this.all(`SELECT name FROM sqlite_master WHERE type='table';`)
    return rows.map(({ name }) => name)
  }

  async _getTableInfo(table: string): Promise<{ name: string; type: string; notnull: boolean; default: string; pk: boolean }[]> {
    const rows = await this.all(`PRAGMA table_info(${utils.escapeId(table)});`)
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const columns = rows.map(({ name, type, notnull, dflt_value, pk }) => ({ name, type, notnull: !!notnull, default: dflt_value, pk: !!pk }))
    return columns
  }

  async _dropTable(table: string) {
    this.run(`DROP TABLE ${utils.escapeId(table)}`)
    delete this.#dbAdapters[table]
  }

  async _dropAll() {
    const tables = await this._getTables()
    for (const table of tables) {
      try {
        await this._dropTable(table)
      } catch {
        // Remove internal tables might cause errors
      }
    }
    this.#dbAdapters = Object.create(null)
  }

  stop() {
    this.db.close()
  }
}

export default SqliteDatabase
