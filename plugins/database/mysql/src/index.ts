import { createPool, escapeId, format, escape as mysqlEscape } from '@vlasky/mysql'
import type { OkPacket, Pool, PoolConfig } from 'mysql'
import { Context, Database, Dict, difference, KoishiError, Logger, makeArray, Model, pick, Query, Schema, Tables, Time } from 'koishi'
import { executeUpdate } from '@koishijs/orm-utils'
import { Builder } from '@koishijs/sql-utils'

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

const DEFAULT_DATE = new Date('1970-01-01')

export type TableType = keyof Tables

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

function backtick(str: string) {
  return '`' + str + '`'
}

function createIndex(keys: string | string[]) {
  return makeArray(keys).map(backtick).join(', ')
}

class MySQLBuilder extends Builder {
  constructor(private model: Model) {
    super()
  }

  format(sql: string, values: any[], stringifyObjects?: boolean, timeZone?: string) {
    return format(sql, values, stringifyObjects, timeZone)
  }

  escapeId(value: string, forbidQualified?: boolean) {
    return escapeId(value, forbidQualified)
  }

  escape(value: any, table?: string, field?: string) {
    return mysqlEscape(this.stringify(value, table, field))
  }

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
}

interface QueryTask {
  sql: string
  resolve: (value: any) => void
  reject: (error: Error) => void
}

class MysqlDatabase extends Database {
  public pool: Pool
  public config: MysqlDatabase.Config

  mysql = this
  sql: MySQLBuilder

  private _tableTasks: Dict<Promise<any>> = {}
  private _queryTasks: QueryTask[] = []

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
        if (Model.Field.string.includes(meta?.type)) {
          return field.string()
        } else if (meta?.type === 'json') {
          const source = field.string()
          return source ? JSON.parse(source) : meta.initial
        } else if (meta?.type === 'list') {
          const source = field.string()
          return source ? source.split(',') : []
        } else if (meta?.type === 'time') {
          const source = field.string()
          if (!source) return meta.initial
          const time = new Date(DEFAULT_DATE)
          const [h, m, s] = source.split(':')
          time.setHours(parseInt(h))
          time.setMinutes(parseInt(m))
          time.setSeconds(parseInt(s))
          return time
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

  async start() {
    this.pool = createPool(this.config)

    for (const name in this.ctx.model.config) {
      this._tableTasks[name] = this._syncTable(name as TableType)
    }

    this.ctx.on('model', (name) => {
      this._tableTasks[name] = this._syncTable(name)
    })
  }

  stop() {
    this.pool.end()
  }

  private _getColDefs(name: TableType, columns: string[]) {
    const table = this.resolveTable(name)
    const { primary, foreign, autoInc } = table
    const fields = { ...table.fields }
    const unique = [...table.unique]
    const result: string[] = []

    // orm definitions
    for (const key in fields) {
      if (columns.includes(key)) continue
      const { initial, nullable = true } = fields[key]
      let def = backtick(key)
      if (key === primary && autoInc) {
        def += ' int unsigned not null auto_increment'
      } else {
        const typedef = getTypeDefinition(fields[key])
        def += ' ' + typedef
        if (makeArray(primary).includes(key)) {
          def += ' not null'
        } else {
          def += (nullable ? ' ' : ' not ') + 'null'
        }
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
        result.push(`foreign key (${backtick(key)}) references ${escapeId(table)} (${backtick(key2)})`)
      }
    }

    return result
  }

  /** synchronize table schema */
  private async _syncTable(name: TableType) {
    await this._tableTasks[name]
    // eslint-disable-next-line max-len
    const data = await this.queue<any[]>('SELECT COLUMN_NAME from information_schema.columns WHERE TABLE_SCHEMA = ? && TABLE_NAME = ?', [this.config.database, name])
    const columns = data.map(row => row.COLUMN_NAME)
    const result = this._getColDefs(name, columns)
    if (!columns.length) {
      logger.info('auto creating table %c', name)
      await this.queue(`CREATE TABLE ?? (${result.join(',')}) COLLATE = ?`, [name, this.config.charset])
    } else if (result.length) {
      logger.info('auto updating table %c', name)
      await this.queue(`ALTER TABLE ?? ${result.map(def => 'ADD ' + def).join(',')}`, [name])
    }
  }

  _inferFields<T extends TableType>(table: T, keys: readonly string[]) {
    if (!keys) return
    const types = MysqlDatabase.tables[table] || {}
    return keys.map((key) => {
      const type = types[key]
      return typeof type === 'function' ? `${type()} AS ${key}` : key
    }) as (keyof Tables[T])[]
  }

  _createFilter(name: TableType, query: Query) {
    return this.sql.parseQuery(this.resolveQuery(name, query))
  }

  _joinKeys = (keys: readonly string[]) => {
    return keys ? keys.map(key => key.includes('`') ? key : `\`${key}\``).join(',') : '*'
  }

  _formatValues = (table: string, data: object, keys: readonly string[]) => {
    return keys.map((key) => this.sql.stringify(data[key], table as never, key))
  }

  query<T = any>(sql: string, values?: any): Promise<T> {
    const error = new Error()
    return new Promise((resolve, reject) => {
      sql = format(sql, values)
      logger.debug('[sql]', sql)
      this.pool.query(sql, (err: Error, results) => {
        if (!err) return resolve(results)
        logger.warn(sql)
        if (err['code'] === 'ER_DUP_ENTRY') {
          err = new KoishiError(err.message, 'database.duplicate-entry')
        }
        err.stack = err.message + error.stack.slice(5)
        reject(err)
      })
    })
  }

  queue<T = any>(sql: string, values?: any): Promise<T> {
    if (!this.config.multipleStatements) {
      return this.query(sql, values)
    }

    sql = format(sql, values)
    return new Promise<any>((resolve, reject) => {
      this._queryTasks.push({ sql, resolve, reject })
      process.nextTick(() => this._flushTasks())
    })
  }

  private async _flushTasks() {
    const tasks = this._queryTasks
    if (!tasks.length) return
    this._queryTasks = []

    try {
      let results = await this.query(tasks.map(task => task.sql).join('; '))
      if (tasks.length === 1) results = [results]
      tasks.forEach((task, index) => {
        task.resolve(results[index])
      })
    } catch (error) {
      tasks.forEach(task => task.reject(error))
    }
  }

  select<T extends {}>(table: string, fields: readonly (string & keyof T)[], conditional?: string, values?: readonly any[]): Promise<T[]>
  select(table: string, fields: string[], conditional?: string, values: readonly any[] = []) {
    logger.debug(`[select] ${table}: ${fields ? fields.join(', ') : '*'}`)
    const sql = 'SELECT '
      + this._joinKeys(fields)
      + (table.includes('.') ? `FROM ${table}` : ' FROM `' + table + `\` _${table}`)
      + (conditional ? ' WHERE ' + conditional : '')
    return this.queue(sql, values)
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
    await this._tableTasks[name]
    const filter = this._createFilter(name, query)
    if (filter === '0') return []
    const { fields, limit, offset, sort } = this.resolveModifier(name, modifier)
    const keys = this._joinKeys(this._inferFields(name, fields))
    let sql = `SELECT ${keys} FROM ${name} _${name} WHERE ${filter}`
    if (sort) sql += ' ORDER BY ' + Object.entries(sort).map(([key, order]) => `${backtick(key)} ${order}`).join(', ')
    if (limit) sql += ' LIMIT ' + limit
    if (offset) sql += ' OFFSET ' + offset
    return this.queue(sql).then((data) => {
      return data.map((row) => this.ctx.model.parse(name, row))
    })
  }

  async set(name: TableType, query: Query, data: {}) {
    data = this.ctx.model.format(name, data)
    await this._tableTasks[name]
    const filter = this._createFilter(name, query)
    if (filter === '0') return
    const keys = Object.keys(data)
    const update = keys.map((key) => {
      const valueExpr = this.sql.parseEval(data[key], name, key)
      return `${backtick(key)} = ${valueExpr}`
    }).join(', ')
    await this.query(`UPDATE ${name} SET ${update} WHERE ${filter}`)
  }

  async remove(name: TableType, query: Query) {
    await this._tableTasks[name]
    const filter = this._createFilter(name, query)
    if (filter === '0') return
    await this.query('DELETE FROM ?? WHERE ' + filter, [name])
  }

  async create<T extends TableType>(name: T, data: {}) {
    await this._tableTasks[name]
    data = this.ctx.model.create(name, data)
    const formatted = this.ctx.model.format(name, data)
    const { autoInc, primary } = this.resolveTable(name)
    const keys = Object.keys(formatted)
    const header = await this.query<OkPacket>(
      `INSERT INTO ?? (${this._joinKeys(keys)}) VALUES (${keys.map(() => '?').join(', ')})`,
      [name, ...this._formatValues(name, formatted, keys)],
    )
    if (!autoInc) return data as any
    return { ...data, [primary as string]: header.insertId } as any
  }

  async upsert(name: TableType, data: any[], keys: string | string[]) {
    if (!data.length) return
    data = data.map(item => this.ctx.model.format(name, item))
    await this._tableTasks[name]

    const { fields, primary } = this.resolveTable(name)
    const merged = {}
    const insertion = data.map((item) => {
      Object.assign(merged, item)
      return this.ctx.model.format(name, executeUpdate(this.ctx.model.create(name), item))
    })
    const indexFields = makeArray(keys || primary)
    const dataFields = Object.keys(merged)
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
      const escaped = backtick(field)
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

  async eval(name: TableType, expr: any, query: Query) {
    await this._tableTasks[name]
    const filter = this._createFilter(name, query)
    const output = this.sql.parseEval(expr)
    const [data] = await this.queue(`SELECT ${output} AS value FROM ${name} WHERE ${filter}`)
    return data.value
  }
}

namespace MysqlDatabase {
  export interface Config extends PoolConfig {}

  export const Config = Schema.object({
    host: Schema.string().description('要连接到的主机名。').default('localhost'),
    port: Schema.natural().max(65535).description('要连接到的端口号。').default(3306),
    user: Schema.string().description('要使用的用户名。').default('root'),
    password: Schema.string().description('要使用的密码。').role('secret'),
    database: Schema.string().description('要访问的数据库名。').default('koishi'),
  })

  type Declarations = {
    [T in TableType]?: {
      [K in keyof Tables[T]]?: () => string
    }
  }

  /**
   * @deprecated use `import('koishi').Field` instead
   */
  export const tables: Declarations = {
    user: {},
    channel: {},
  }
}

export default MysqlDatabase
