import { createPool, Pool, PoolConfig, escape as mysqlEscape, escapeId, format, TypeCast } from 'mysql'
import { Context, Database, difference, Logger, makeArray, Schema, Query, Model, Tables as KoishiTables, Dict, Time, KoishiError, pick } from 'koishi'
import { executeUpdate } from '@koishijs/orm-utils'
import { Builder } from '@koishijs/sql-utils'
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

export interface Tables extends KoishiTables {}

function getIntegerType(length = 11) {
  if (length <= 4) return 'tinyint'
  if (length <= 6) return 'smallint'
  if (length <= 9) return 'mediumint'
  if (length <= 11) return 'int'
  return 'bigint'
}

function getTypeDefinition({ type, length, precision, scale }: Model.Field) {
  switch (type) {
    case 'float':
    case 'double':
    case 'date':
    case 'time': return type
    case 'timestamp': return 'datetime'
    case 'integer': return getIntegerType(length)
    case 'unsigned': return `${getIntegerType(length)} unsigned`
    case 'decimal': return `decimal(${precision}, ${scale}) unsigned`
    case 'char': return `char(${length || 255})`
    case 'string': return `varchar(${length || 255})`
    case 'text': return `text(${length || 65535})`
    case 'list': return `text(${length || 65535})`
    case 'json': return `text(${length || 65535})`
  }
}

function createIndex(keys: string | string[]) {
  return makeArray(keys).map(key => escapeId(key)).join(', ')
}

class MySQLBuilder extends Builder {
  constructor(private model: Model) {
    super()
  }

  escapeId = escapeId

  stringify(value: any, table?: string, field?: string) {
    const type = MysqlDatabase.tables[table]?.[field]
    if (typeof type === 'object') return type.stringify(value)

    const meta = this.model.config[table]?.fields[field]
    if (meta?.type === 'json') {
      return JSON.stringify(value)
    } else if (meta?.type === 'list') {
      return value.join(',')
    } else if (Model.Field.date.includes(meta?.type)) {
      return Time.template('yyyy-MM-dd hh:mm:ss', value)
    }

    return value
  }

  escape(value: any, table?: string, field?: string) {
    return mysqlEscape(this.stringify(value, table, field))
  }
}

class MysqlDatabase extends Database {
  public pool: Pool
  public config: MysqlDatabase.Config

  mysql = this
  sql: MySQLBuilder

  private tasks: Dict<Promise<any>> = {}

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

        const meta = this.ctx.model.config[orgTable]?.fields[orgName]
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

    this.sql = new MySQLBuilder(this.ctx.model)
  }

  private getColDefs(name: string, columns: string[]) {
    const table = this.ctx.model.config[name]
    const { primary, foreign, autoInc } = table
    const fields = { ...table.fields }
    const unique = [...table.unique]
    const result: string[] = []

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
      if (columns.includes(key) || typeof value === 'function') continue
      result.push(`${escapeId(key)} ${MysqlDatabase.Domain.definition(value)}`)
    }

    // orm definitions
    for (const key in fields) {
      if (columns.includes(key)) continue
      const { initial, nullable = true } = fields[key]
      let def = escapeId(key)
      if (key === primary && autoInc) {
        def += ' int unsigned not null auto_increment'
      } else {
        const typedef = getTypeDefinition(fields[key])
        def += ' ' + typedef + (nullable ? ' ' : ' not ') + 'null'
        // blob, text, geometry or json columns cannot have default values
        if (initial && !typedef.startsWith('text')) {
          def += ' default ' + this.sql.escape(initial, name, key)
        }
      }
      result.push(def)
    }

    if (!columns.length) {
      result.push(`primary key (${createIndex(primary)})`)
      for (const key of unique) {
        result.push(`unique index (${createIndex(key)})`)
      }
      for (const key in foreign) {
        const [table, key2] = foreign[key]
        result.push(`foreign key (${escapeId(key)}) references ${escapeId(table)} (${escapeId(key2)})`)
      }
    }

    return result
  }

  async start() {
    this.pool = createPool(this.config)

    for (const name in this.ctx.model.config) {
      this.tasks[name] = this._syncTable(name)
    }

    this.ctx.on('model', (name) => {
      this.tasks[name] = this._syncTable(name)
    })
  }

  /** synchronize table schema */
  private async _syncTable(name: string) {
    await this.tasks[name]
    const data = await this.query<any[]>('SELECT COLUMN_NAME from information_schema.columns WHERE TABLE_SCHEMA = ? && TABLE_NAME = ?', [this.config.database, name])
    const columns = data.map(row => row.COLUMN_NAME)
    const result = this.getColDefs(name, columns)
    if (!columns.length) {
      logger.info('auto creating table %c', name)
      await this.query(`CREATE TABLE ?? (${result.join(',')}) COLLATE = ?`, [name, this.config.charset])
    } else if (result.length) {
      logger.info('auto updating table %c', name)
      await this.query(`ALTER TABLE ?? ${result.map(def => 'ADD ' + def).join(',')}`, [name])
    }
  }

  _createFilter(name: TableType, query: Query) {
    return this.sql.parseQuery(this.ctx.model.resolveQuery(name, query))
  }

  _joinKeys = (keys: readonly string[]) => {
    return keys ? keys.map(key => key.includes('`') ? key : `\`${key}\``).join(',') : '*'
  }

  _formatValues = (table: string, data: object, keys: readonly string[]) => {
    return keys.map((key) => this.sql.stringify(data[key], table as never, key))
  }

  query<T = any>(source: string, values?: any): Promise<T>
  query<T = any>(source: string[], values?: any): Promise<T>
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
          reject(new KoishiError(err.message, 'database.duplicate-entry'))
        } else {
          reject(err)
        }
      })
    })
  }

  select<T extends {}>(table: string, fields: readonly (string & keyof T)[], conditional?: string, values?: readonly any[]): Promise<T[]>
  select(table: string, fields: string[], conditional?: string, values: readonly any[] = []) {
    logger.debug(`[select] ${table}: ${fields ? fields.join(', ') : '*'}`)
    const sql = 'SELECT '
      + this._joinKeys(fields)
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

  async drop() {
    const data = await this.select('information_schema.tables', ['TABLE_NAME'], 'TABLE_SCHEMA = ?', [this.config.database])
    if (!data.length) return
    await this.query(data.map(({ TABLE_NAME }) => `DROP TABLE ${this.sql.escapeId(TABLE_NAME)}`).join('; '))
  }

  async stats() {
    const data = await this.select('information_schema.tables', ['TABLE_NAME', 'TABLE_ROWS', 'DATA_LENGTH'], 'TABLE_SCHEMA = ?', [this.config.database])
    const stats: Query.Stats = { size: 0 }
    stats.tables = Object.fromEntries(data.map(({ TABLE_NAME: name, TABLE_ROWS: count, DATA_LENGTH: size }) => {
      stats.size += size
      return [name, { count, size }]
    }))
    return stats
  }

  async get(name: TableType, query: Query, modifier?: Query.Modifier) {
    const filter = this._createFilter(name, query)
    if (filter === '0') return []
    const { fields, limit, offset, sort } = Query.resolveModifier(modifier)
    const keys = this._joinKeys(this.inferFields(name, fields))
    let sql = `SELECT ${keys} FROM ${name} _${name} WHERE ${filter}`
    if (limit) sql += ' LIMIT ' + limit
    if (offset) sql += ' OFFSET ' + offset
    if (sort) sql += ' ORDER BY ' + Object.entries(sort).map(([key, order]) => `${this.sql.escapeId(key)} ${order}`).join(', ')
    return this.query(sql)
  }

  async set(name: TableType, query: Query, data: {}) {
    await this.tasks[name]
    const filter = this._createFilter(name, query)
    if (filter === '0') return
    const keys = Object.keys(data)
    const update = keys.map((key) => {
      const valueExpr = this.sql.parseEval(data[key], name, key)
      const [field, ...rest] = key.split('.')
      const keyExpr = this.sql.escapeId(field)
      if (!rest.length) return `${keyExpr} = ${valueExpr}`
      return `${keyExpr} = json_set(ifnull(${keyExpr}, '{}'), '$${rest.map(key => `."${key}"`).join('')}', ${valueExpr})`
    }).join(', ')
    await this.query(`UPDATE ${name} SET ${update} WHERE ${filter}`)
  }

  async remove(name: TableType, query: Query) {
    const filter = this._createFilter(name, query)
    if (filter === '0') return
    await this.query('DELETE FROM ?? WHERE ' + filter, [name])
  }

  async create(name: TableType, data: {}) {
    await this.tasks[name]
    data = { ...this.ctx.model.create(name), ...data }
    const keys = Object.keys(data)
    const header = await this.query<OkPacket>(
      `INSERT INTO ?? (${this._joinKeys(keys)}) VALUES (${keys.map(() => '?').join(', ')})`,
      [name, ...this._formatValues(name, data, keys)],
    )
    return { ...data, id: header.insertId } as any
  }

  async upsert(name: TableType, data: any[], keys: string | string[]) {
    if (!data.length) return
    await this.tasks[name]

    const { fields, primary } = this.ctx.model.config[name]
    const merged = {}
    const insertion = data.map((item) => {
      Object.assign(merged, item)
      return executeUpdate(this.ctx.model.create(name), item)
    })
    const indexFields = makeArray(keys || primary)
    const dataFields = [...new Set(Object.keys(merged).map(key => key.split('.', 1)[0]))]
    const updateFields = difference(dataFields, indexFields)

    const createFilter = (item: any) => this.sql.parseQuery(pick(item, indexFields))
    const createMultiFilter = (items: any[]) => {
      if (items.length === 1) {
        return createFilter(items[0])
      } else if (indexFields.length === 1) {
        const key = indexFields[0]
        return this.sql.parseQuery({ [key]: items.map(item => item[key]) })
      } else {
        return items.map(createFilter).join(' OR ')
      }
    }

    const update = updateFields.map((field) => {
      const escaped = this.sql.escapeId(field)
      const branches: Dict<string> = {}
      const absent = data.filter((item) => {
        // update directly
        if (field in item) {
          if (Object.keys(item[field]).some(key => key.startsWith('$'))) {
            branches[createFilter(item)] = this.sql.parseEval(item[field], name, field)
          }
          return
        }

        // update with json_set
        const valueInit = `ifnull(${escaped}, '{}')`
        let value = valueInit
        for (const key in item) {
          const [first, ...rest] = key.split('.')
          if (first !== field) continue
          value = `json_set(${value}, '$${rest.map(key => `."${key}"`).join('')}', ${this.sql.parseEval(item[key])})`
        }
        if (value === valueInit) return true
        branches[createFilter(item)] = value
      })

      if (absent.length) branches[createMultiFilter(absent)] = escaped
      let value = `VALUES(${escaped})`
      for (const condition in branches) {
        value = `if(${condition}, ${branches[condition]}, ${value})`
      }
      return `${escaped} = ${value}`
    }).join(', ')

    const initFields = Object.keys(fields)
    const placeholder = `(${initFields.map(() => '?').join(', ')})`
    await this.query(
      `INSERT INTO ${this.sql.escapeId(name)} (${this._joinKeys(initFields)}) VALUES ${data.map(() => placeholder).join(', ')}
      ON DUPLICATE KEY UPDATE ${update}`,
      [].concat(...insertion.map(item => this._formatValues(name, item, initFields))),
    )
  }

  async aggregate(name: TableType, fields: {}, query: Query) {
    const keys = Object.keys(fields)
    if (!keys.length) return {}

    const filter = this._createFilter(name, query)
    const exprs = keys.map(key => `${this.sql.parseEval(fields[key])} AS ${this.sql.escapeId(key)}`).join(', ')
    const [data] = await this.query(`SELECT ${exprs} FROM ${name} WHERE ${filter}`)
    return data
  }
}

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

export default MysqlDatabase
