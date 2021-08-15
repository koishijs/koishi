import { createPool, Pool, PoolConfig, escape as mysqlEscape, escapeId, format, TypeCast } from 'mysql'
import { App, Database, Logger } from 'koishi'
import * as Koishi from 'koishi'
import { types } from 'util'

declare module 'mysql' {
  interface UntypedFieldInfo {
    packet: UntypedFieldInfo
  }
}

export type TableType = keyof Tables

export interface Tables extends Koishi.Tables {}

const logger = new Logger('mysql')

export interface Config extends PoolConfig {}

function stringify(value: any, table?: TableType, field?: string) {
  const type = MysqlDatabase.tables[table]?.[field]
  if (typeof type === 'object') return type.stringify(value)

  const meta = (Koishi.Tables.config[table] as Koishi.Tables.Config)?.fields[field]
  if (meta?.type === 'json') {
    return JSON.stringify(value)
  } else if (meta?.type === 'list') {
    return value.join(',')
  }

  return value
}

function escape(value: any, table?: TableType, field?: string) {
  return mysqlEscape(stringify(value, table, field))
}

function getTypeDefinition({ type, length, precision, scale }: Koishi.Tables.Field) {
  switch (type) {
    case 'float':
    case 'double':
    case 'date':
    case 'time':
    case 'timestamp': return type
    case 'integer': return `int(${length || 10})`
    case 'unsigned': return `int(${length || 10}) unsigned`
    case 'decimal': return `int(${precision}, ${scale}) unsigned`
    case 'char': return `char(${length || 64})`
    case 'string': return `char(${length || 256})`
    case 'text': return `text(${length || 65535})`
    case 'list': return `text(${length || 65535})`
    case 'json': return `text(${length || 65535})`
  }
}

class MysqlDatabase extends Database {
  public pool: Pool
  public config: Config

  mysql = this

  escape: (value: any, table?: TableType, field?: string) => string
  escapeId: (value: string) => string

  inferFields<T extends TableType>(table: T, keys: readonly string[]) {
    if (!keys) return
    const types = MysqlDatabase.tables[table] || {}
    return keys.map((key) => {
      const type = types[key]
      return typeof type === 'function' ? `${type()} AS ${key}` : key
    }) as (keyof Tables[T])[]
  }

  constructor(public app: App, config?: Config) {
    super(app)
    this.config = {
      database: 'koishi',
      charset: 'utf8mb4_general_ci',
      typeCast: (field, next) => {
        const { orgName, orgTable } = field.packet
        const type = MysqlDatabase.tables[orgTable]?.[orgName]
        if (typeof type === 'object') return type.parse(field)

        const meta = (Koishi.Tables.config[orgTable] as Koishi.Tables.Config)?.fields[orgName]
        if (meta?.type === 'string') {
          return field.string()
        } else if (meta?.type === 'json') {
          return JSON.parse(field.string()) || meta.initial
        } else if (meta?.type === 'list') {
          const source = field.string()
          return source ? source.split(',') : []
        }

        if (field.type === 'BIT') {
          return Boolean(field.buffer()?.readUInt8(0))
        } else {
          return next()
        }
      },
      ...config,
    }
  }

  async start() {
    this.pool = createPool(this.config)
    const data = await this.select('information_schema.columns', ['TABLE_NAME', 'COLUMN_NAME'], 'TABLE_SCHEMA = ?', [this.config.database])
    const tables: Record<string, string[]> = {}
    for (const { TABLE_NAME, COLUMN_NAME } of data) {
      if (!tables[TABLE_NAME]) tables[TABLE_NAME] = []
      tables[TABLE_NAME].push(COLUMN_NAME)
    }

    for (const name in MysqlDatabase.tables) {
      const table = { ...MysqlDatabase.tables[name] }
      // create platform rows
      const platforms = new Set<string>(this.app.bots.map(bot => bot.platform))
      if (name === 'user') {
        for (const name of platforms) {
          table[name] = 'varchar(50) null default null'
        }
      }
      if (!tables[name]) {
        const cols = Object.keys(table)
          .filter((key) => typeof table[key] !== 'function')
          .map((key) => `${escapeId(key)} ${MysqlDatabase.Domain.definition(table[key])}`)
        const { type, primary, unique, foreign, fields } = Koishi.Tables.config[name] as Koishi.Tables.Config
        cols.push(`primary key (${escapeId(primary)})`)
        for (const key of unique) {
          if (Array.isArray(key)) {
            cols.push(`unique index (${key.map(key => escapeId(key)).join(', ')})`)
          } else {
            cols.push(`unique index (${escapeId(key)})`)
          }
        }
        if (name === 'user') {
          for (const key of platforms) {
            cols.push(`unique index (${escapeId(key)})`)
          }
        }
        for (const key in foreign) {
          const [table, key2] = foreign[key]
          cols.push(`foreign key (${escapeId(key)}) references ${escapeId(table)} (${escapeId(key2)})`)
        }
        for (const key in fields) {
          const { initial, nullable = initial === undefined } = fields[key]
          let def = escapeId(key)
          if (key === primary && type === 'incremental') {
            def += ' bigint(20) unsigned not null auto_increment'
          } else {
            def += ' ' + getTypeDefinition(fields[key])
            def += (nullable ? ' ' : ' not ') + 'null'
            if (initial && typeof initial !== 'string') {
              // mysql does not support text column with default value
              def += ' default ' + mysqlEscape(initial)
            }
          }
          cols.push(def)
        }
        logger.info('auto creating table %c', name)
        await this.query(`CREATE TABLE ?? (${cols.join(',')}) COLLATE = ?`, [name, this.config.charset])
      } else {
        const cols = Object.keys(table)
          .filter(key => typeof table[key] !== 'function' && !tables[name].includes(key))
          .map(key => `ADD \`${key}\` ${MysqlDatabase.Domain.definition(table[key])}`)
        if (!cols.length) continue
        logger.info('auto updating table %c', name)
        await this.query(`ALTER TABLE ?? ${cols.join(',')}`, [name])
      }
    }
  }

  joinKeys = (keys: readonly string[]) => {
    return keys ? keys.map(key => key.includes('`') ? key : `\`${key}\``).join(',') : '*'
  }

  $in = (table: TableType, key: string, values: readonly any[]) => {
    return `${this.escapeId(key)} IN (${values.map(val => this.escape(val, table, key)).join(', ')})`
  }

  formatValues = (table: string, data: object, keys: readonly string[]) => {
    return keys.map((key) => {
      if (typeof data[key] !== 'object' || types.isDate(data[key])) return data[key]
      return stringify(data[key], table as never, key)
    })
  }

  query<T extends {}>(source: string, values?: any): Promise<T>
  query<T extends {}>(source: string[], values?: any): Promise<T>
  async query<T extends {}>(source: string | string[], values?: any): Promise<T> {
    if (Array.isArray(source)) {
      if (this.config.multipleStatements) {
        return this.query(source.join(';'), values)
      } else {
        const result: any = []
        for (const sql of source) {
          result.push(await this.query(sql, values))
        }
        return result
      }
    }

    const error = new Error()
    return new Promise((resolve, reject) => {
      const sql = format(source, values)
      logger.debug('[sql]', sql)
      this.pool.query(sql, (err, results) => {
        if (!err) return resolve(results)
        logger.warn(sql)
        err.stack = err.message + error.stack.slice(7)
        if (err.code === 'ER_DUP_ENTRY') {
          err[Symbol.for('koishi.error-type')] = 'duplicate-entry'
        }
        reject(err)
      })
    })
  }

  select<T extends {}>(table: string, fields: readonly (string & keyof T)[], conditional?: string, values?: readonly any[]): Promise<T[]>
  select(table: string, fields: string[], conditional?: string, values: readonly any[] = []) {
    logger.debug(`[select] ${table}: ${fields ? fields.join(', ') : '*'}`)
    const sql = 'SELECT '
      + this.joinKeys(fields)
      + (table.includes('.') ? `FROM ${table}` : ' FROM `' + table + `\` _${table}`)
      + (conditional ? ' WHERE ' + conditional : '')
    return this.query(sql, values)
  }

  async count<K extends TableType>(table: K, conditional?: string) {
    const [{ 'COUNT(*)': count }] = await this.query(`SELECT COUNT(*) FROM ?? ${conditional ? 'WHERE ' + conditional : ''}`, [table])
    return count as number
  }

  stop() {
    this.pool.end()
  }
}

MysqlDatabase.prototype.escape = escape
MysqlDatabase.prototype.escapeId = escapeId

namespace MysqlDatabase {
  type Declarations = {
    [T in TableType]?: {
      [K in keyof Tables[T]]?: string | (() => string) | Domain<Tables[T][K]>
    }
  }

  /**
   * @deprecated use `import('koishi-core').Field` instead
   */
  export const tables: Declarations = {
    user: {},
    channel: {},
  }

  type FieldInfo = Parameters<Exclude<TypeCast, boolean>>[0]

  export interface Domain<T = any> {
    definition: string
    parse(source: FieldInfo): T
    stringify(value: T): string
  }

  /**
   * @deprecated use `import('koishi-core').Field` instead
   */
  export namespace Domain {
    export function definition(domain: string | Domain) {
      return typeof domain === 'string' ? domain : domain.definition
    }

    export class String implements Domain<string> {
      constructor(public definition = 'TEXT') {}

      parse(field: FieldInfo) {
        return field.string()
      }

      stringify(value: any) {
        return value
      }
    }

    export class Array implements Domain<string[]> {
      constructor(public definition = 'TEXT') {}

      parse(field: FieldInfo) {
        const source = field.string()
        return source ? source.split(',') : []
      }

      stringify(value: string[]) {
        return value.join(',')
      }
    }

    export class Json implements Domain {
      // mysql does not support text column with default value
      constructor(public definition = 'text', private defaultValue?: any) {}

      parse(field: FieldInfo) {
        return JSON.parse(field.string()) || this.defaultValue
      }

      stringify(value: any) {
        return JSON.stringify(value)
      }
    }
  }
}

export default MysqlDatabase
