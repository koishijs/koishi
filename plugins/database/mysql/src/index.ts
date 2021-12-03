import { createPool, Pool, PoolConfig, escape as mysqlEscape, escapeId, format, TypeCast } from 'mysql'
import { Context, Database, difference, Logger, makeArray, Schema, Query } from 'koishi'
import { SQLBuilder } from '@koishijs/sql-utils'
import * as Koishi from 'koishi'
import { types } from 'util'
import { OkPacket } from 'mysql'

declare module 'mysql' {
  interface UntypedFieldInfo {
    packet: UntypedFieldInfo
  }
}

declare module 'koishi' {
  interface Database {
    mysql: MysqlDatabase
  }

  interface Modules {
    'database-mysql': typeof import('.')
  }
}

const logger = new Logger('mysql')

export type TableType = keyof Tables

export interface Tables extends Koishi.Tables {}

function stringify(value: any, table?: string, field?: string) {
  const type = MysqlDatabase.tables[table]?.[field]
  if (typeof type === 'object') return type.stringify(value)

  const meta = Koishi.Tables.config[table]?.fields[field]
  if (meta?.type === 'json') {
    return JSON.stringify(value)
  } else if (meta?.type === 'list') {
    return value.join(',')
  }

  return value
}

function escape(value: any, table?: string, field?: string) {
  return mysqlEscape(stringify(value, table, field))
}

function getIntegerType(length = 11) {
  if (length <= 4) return 'tinyint'
  if (length <= 6) return 'smallint'
  if (length <= 9) return 'mediumint'
  if (length <= 11) return 'int'
  return 'bigint'
}

function getTypeDefinition({ type, length, precision, scale }: Koishi.Tables.Field) {
  switch (type) {
    case 'float':
    case 'double':
    case 'date':
    case 'time':
    case 'timestamp': return type
    case 'integer': return getIntegerType(length)
    case 'unsigned': return `${getIntegerType(length)} unsigned`
    case 'decimal': return `decimal(${precision}, ${scale}) unsigned`
    case 'char': return `char(${length || 255})`
    case 'string': return `char(${length || 255})`
    case 'text': return `text(${length || 65535})`
    case 'list': return `text(${length || 65535})`
    case 'json': return `text(${length || 65535})`
  }
}

function createIndex(keys: string | string[]) {
  return makeArray(keys).map(key => escapeId(key)).join(', ')
}

class MysqlDatabase extends Database {
  public pool: Pool
  public config: MysqlDatabase.Config

  mysql = this
  sql: SQLBuilder

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

  constructor(public ctx: Context, config?: MysqlDatabase.Config) {
    super(ctx)
    this.config = {
      host: 'localhost',
      port: 3306,
      user: 'root',
      database: 'koishi',
      charset: 'utf8mb4_general_ci',
      multipleStatements: true,
      typeCast: (field, next) => {
        const { orgName, orgTable } = field.packet
        const type = MysqlDatabase.tables[orgTable]?.[orgName]
        if (typeof type === 'object') return type.parse(field)

        const meta = Koishi.Tables.config[orgTable]?.fields[orgName]
        if (meta?.type === 'string') {
          return field.string()
        } else if (meta?.type === 'json') {
          const source = field.string()
          return source ? JSON.parse(source) : meta.initial
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

    this.sql = new class extends SQLBuilder {
      escape = escape
      escapeId = escapeId
    }()
  }

  private columns: Record<string, string[]> = {}

  private getColDefs(name: string, cols: string[] = []) {
    const table = Koishi.Tables.config[name]
    const { primary, foreign, autoInc } = table
    const fields = { ...table.fields }
    const unique = [...table.unique]
    const keys = this.columns[name] || []

    // create platform rows
    if (name === 'user') {
      const platforms = new Set<string>(this.ctx.bots.map(bot => bot.platform))
      for (const name of platforms) {
        fields[name] = { type: 'string', length: 63 }
        unique.push(name)
      }
    }

    // mysql definitions (FIXME: remove in v4)
    for (const key in MysqlDatabase.tables[name]) {
      const value = MysqlDatabase.tables[name][key]
      if (keys.includes(key) || typeof value === 'function') continue
      cols.push(`${escapeId(key)} ${MysqlDatabase.Domain.definition(value)}`)
    }

    // orm definitions
    for (const key in fields) {
      if (keys.includes(key)) continue
      const { initial, nullable = true } = fields[key]
      let def = escapeId(key)
      if (key === primary && autoInc) {
        def += ' int unsigned not null auto_increment'
      } else {
        const typedef = getTypeDefinition(fields[key])
        def += ' ' + typedef + (nullable ? ' ' : ' not ') + 'null'
        // blob, text, geometry or json columns cannot have default values
        if (initial && !typedef.startsWith('text')) {
          def += ' default ' + escape(initial, name, key)
        }
      }
      cols.push(def)
    }

    if (!keys.length) {
      cols.push(`primary key (${createIndex(primary)})`)
      for (const key of unique) {
        cols.push(`unique index (${createIndex(key)})`)
      }
      for (const key in foreign) {
        const [table, key2] = foreign[key]
        cols.push(`foreign key (${escapeId(key)}) references ${escapeId(table)} (${escapeId(key2)})`)
      }
    }

    return cols
  }

  async start() {
    this.pool = createPool(this.config)
    const data = await this.query<any[]>('SELECT TABLE_NAME, COLUMN_NAME from information_schema.columns WHERE TABLE_SCHEMA = ?', [this.config.database])
    for (const { TABLE_NAME, COLUMN_NAME } of data) {
      (this.columns[TABLE_NAME] ||= []).push(COLUMN_NAME)
    }

    for (const name in Koishi.Tables.config) {
      const cols = this.getColDefs(name)
      if (!this.columns[name]) {
        logger.info('auto creating table %c', name)
        await this.query(`CREATE TABLE ?? (${cols.join(',')}) COLLATE = ?`, [name, this.config.charset])
      } else if (cols.length) {
        logger.info('auto updating table %c', name)
        await this.query(`ALTER TABLE ?? ${cols.map(def => 'ADD ' + def).join(',')}`, [name])
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
  export interface Config extends PoolConfig {}

  export const Config = Schema.object({
    host: Schema.string().description('要连接到的主机名。').default('localhost'),
    port: Schema.number().description('要连接到的端口号。').default(3306),
    user: Schema.string().description('要使用的用户名。').default('root'),
    password: Schema.string().description('要使用的密码。'),
    database: Schema.string().description('要访问的数据库名。').default('koishi'),
  })

  type Declarations = {
    [T in TableType]?: {
      [K in keyof Tables[T]]?: string | (() => string) | Domain<Tables[T][K]>
    }
  }

  /**
   * @deprecated use `import('koishi').Field` instead
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
   * @deprecated use `import('koishi').Field` instead
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

Database.extend(MysqlDatabase, {
  async drop(name) {
    if (name) {
      await this.query(`DROP TABLE ${this.escapeId(name)}`)
    } else {
      const data = await this.select('information_schema.tables', ['TABLE_NAME'], 'TABLE_SCHEMA = ?', [this.config.database])
      if (!data.length) return
      await this.query(data.map(({ TABLE_NAME }) => `DROP TABLE ${this.escapeId(TABLE_NAME)}`).join('; '))
    }
  },

  async get(name, query, modifier) {
    const filter = this.sql.parseQuery(Query.resolve(name, query))
    if (filter === '0') return []
    const { fields, limit, offset } = Query.resolveModifier(modifier)
    const keys = this.joinKeys(this.inferFields(name, fields))
    let sql = `SELECT ${keys} FROM ${name} _${name} WHERE ${filter}`
    if (limit) sql += ' LIMIT ' + limit
    if (offset) sql += ' OFFSET ' + offset
    return this.query(sql)
  },

  async set(name, query, data) {
    const filter = this.sql.parseQuery(Query.resolve(name, query))
    if (filter === '0') return
    const keys = Object.keys(data)
    const update = keys.map((key) => {
      return `${this.escapeId(key)} = ${this.escape(data[key], name, key)}`
    }).join(', ')
    await this.query(`UPDATE ${name} SET ${update} WHERE ${filter}`)
  },

  async remove(name, query) {
    const filter = this.sql.parseQuery(Query.resolve(name, query))
    if (filter === '0') return
    await this.query('DELETE FROM ?? WHERE ' + filter, [name])
  },

  async create(name, data) {
    data = { ...Koishi.Tables.create(name), ...data }
    const keys = Object.keys(data)
    const header = await this.query<OkPacket>(
      `INSERT INTO ?? (${this.joinKeys(keys)}) VALUES (${keys.map(() => '?').join(', ')})`,
      [name, ...this.formatValues(name, data, keys)],
    )
    return { ...data, id: header.insertId } as any
  },

  async upsert(name, data, keys: string | string[]) {
    if (!data.length) return
    const { fields, primary } = Koishi.Tables.config[name]
    const fallback = Koishi.Tables.create(name)
    const initKeys = Object.keys(fields)
    const updateKeys = Object.keys(data[0])
    data = data.map(item => ({ ...fallback, ...item }))
    keys = makeArray(keys || primary)
    const placeholder = `(${initKeys.map(() => '?').join(', ')})`
    const update = difference(updateKeys, keys).map((key) => {
      key = this.escapeId(key)
      return `${key} = VALUES(${key})`
    }).join(', ')
    await this.query(
      `INSERT INTO ${this.escapeId(name)} (${this.joinKeys(initKeys)}) VALUES ${data.map(() => placeholder).join(', ')}
      ON DUPLICATE KEY UPDATE ${update}`,
      [].concat(...data.map(data => this.formatValues(name, data, initKeys))),
    )
  },

  async aggregate(name, fields, query) {
    const keys = Object.keys(fields)
    if (!keys.length) return {}

    const filter = this.sql.parseQuery(Query.resolve(name, query))
    const exprs = keys.map(key => `${this.sql.parseEval(fields[key])} AS ${this.escapeId(key)}`).join(', ')
    const [data] = await this.query(`SELECT ${exprs} FROM ${name} WHERE ${filter}`)
    return data
  },
})

export default MysqlDatabase
