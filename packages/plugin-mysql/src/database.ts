import { createPool, Pool, PoolConfig, escape as mysqlEscape, escapeId, format, OkPacket, TypeCast } from 'mysql'
import { TableType, Tables, App } from 'koishi-core'
import { Logger } from 'koishi-utils'
import { types } from 'util'

declare module 'mysql' {
  interface UntypedFieldInfo {
    packet: UntypedFieldInfo
  }
}

const logger = new Logger('mysql')

export interface Config extends PoolConfig {}

class MysqlDatabase {
  public pool: Pool
  public config: Config

  escapeId: (value: string) => string

  escape(value: any, table?: TableType, field?: string) {
    const type = MysqlDatabase.tables[table]?.[field]
    return mysqlEscape(typeof type === 'object' ? type.toString(value) : value)
  }

  inferFields<T extends TableType>(table: T, keys: readonly string[]) {
    const types = MysqlDatabase.tables[table] || {}
    return keys.map((key) => {
      const type = types[key]
      return typeof type === 'function' ? `${type()} AS ${key}` : key
    }) as (keyof Tables[T])[]
  }

  constructor(public app: App, config: Config) {
    this.config = {
      database: 'koishi',
      charset: 'utf8mb4_general_ci',
      typeCast: (field, next) => {
        const type = MysqlDatabase.tables[field.packet.orgTable]?.[field.packet.orgName]
        if (typeof type === 'object') {
          return type.valueOf(field)
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
      if (name === 'user') {
        let index = MysqlDatabase.tables[name]['length']
        const platforms = new Set<string>(this.app.bots.map(bot => bot.platform))
        platforms.forEach(name => {
          const key = escapeId(name)
          table[name] = 'varchar(50) null default null'
          table[index++] = `unique index ${key} (${key}) using btree`
        })
      }
      if (!tables[name]) {
        const cols = Object.keys(table)
          .filter((key) => typeof table[key] !== 'function')
          .map((key) => {
            if (+key * 0 === 0) return table[key]
            return `\`${key}\` ${MysqlDatabase.Domain.definition(table[key])}`
          })
        logger.info('auto creating table %c', name)
        await this.query(`CREATE TABLE ?? (${cols.join(',')}) COLLATE = ?`, [name, this.config.charset])
      } else {
        const cols = Object.keys(table)
          .filter(key => +key * 0 !== 0 && typeof table[key] !== 'function' && !tables[name].includes(key))
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

  formatValues = (table: string, data: object, keys: readonly string[]) => {
    return keys.map((key) => {
      if (typeof data[key] !== 'object' || types.isDate(data[key])) return data[key]
      const type = MysqlDatabase.tables[table]?.[key]
      if (type && typeof type !== 'string') return type.toString(data[key])
      return JSON.stringify(data[key])
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

  async create<K extends TableType>(table: K, data: Partial<Tables[K]>): Promise<Tables[K]> {
    const keys = Object.keys(data)
    if (!keys.length) return
    logger.debug(`[create] ${table}: ${data}`)
    const header = await this.query<OkPacket>(
      `INSERT INTO ?? (${this.joinKeys(keys)}) VALUES (${keys.map(() => '?').join(', ')})`,
      [table, ...this.formatValues(table, data, keys)],
    )
    return { ...data, id: header.insertId } as any
  }

  async update<K extends TableType>(table: K, data: Partial<Tables[K]>[]): Promise<OkPacket>
  async update<K extends TableType>(table: K, id: number | string, data: Partial<Tables[K]>): Promise<OkPacket>
  async update<K extends TableType>(table: K, arg1: number | string | Tables[K][], data?: Partial<Tables[K]>) {
    if (typeof arg1 === 'object') {
      if (!arg1.length) return
      const keys = Object.keys(arg1[0])
      const placeholder = `(${keys.map(() => '?').join(', ')})`
      const header = await this.query(
        `INSERT INTO ?? (${this.joinKeys(keys)}) VALUES ${arg1.map(() => placeholder).join(', ')}
        ON DUPLICATE KEY UPDATE ${keys.filter(key => key !== 'id').map(key => `\`${key}\` = VALUES(\`${key}\`)`).join(', ')}`,
        [table, ...[].concat(...arg1.map(data => this.formatValues(table, data, keys)))],
      )
      return header as OkPacket
    }

    const keys = Object.keys(data)
    if (!keys.length) return
    const header = await this.query(
      'UPDATE ?? SET ' + keys.map(key => `\`${key}\` = ?`).join(', ') + ' WHERE `id` = ?',
      [table, ...this.formatValues(table, data, keys), arg1],
    )
    return header as OkPacket
  }

  async count<K extends TableType>(table: K, conditional?: string) {
    const [{ 'COUNT(*)': count }] = await this.query(`SELECT COUNT(*) FROM ?? ${conditional ? 'WHERE ' + conditional : ''}`, [table])
    return count as number
  }

  stop() {
    this.pool.end()
  }
}

MysqlDatabase.prototype.escapeId = escapeId

namespace MysqlDatabase {
  type Declarations = {
    [T in TableType]?: {
      [K in keyof Tables[T]]: string | (() => string) | Domain<Tables[T][K]>
    }
  }

  export const tables: Declarations = {}

  type FieldInfo = Parameters<Exclude<TypeCast, boolean>>[0]

  export interface Domain<T = any> {
    definition: string
    toString(value: T): string
    valueOf(source: FieldInfo): T
  }

  export namespace Domain {
    export function definition(domain: string | Domain) {
      return typeof domain === 'string' ? domain : domain.definition
    }

    export class String implements Domain<string> {
      constructor(public definition = 'TEXT') {}

      toString(value: any) {
        return value
      }

      valueOf(field: FieldInfo) {
        return field.string()
      }
    }

    export class Array implements Domain<string[]> {
      constructor(public definition = 'TEXT') {}

      toString(value: string[]) {
        return value.join(',')
      }

      valueOf(field: FieldInfo) {
        const source = field.string()
        return source ? source.split(',') : []
      }
    }

    export class Json implements Domain {
      constructor(public definition = 'JSON') {}

      toString(value: any) {
        return JSON.stringify(value)
      }

      valueOf(field: FieldInfo) {
        return JSON.parse(field.string())
      }
    }
  }
}

export default MysqlDatabase
