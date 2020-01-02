import { createPool, Pool, PoolConfig, escape, escapeId } from 'mysql'
import { registerDatabase, AbstractDatabase, TableType, TableData } from 'koishi-core'
import { types } from 'util'

declare module 'koishi-core/dist/database' {
  interface Subdatabases {
    mysql: MysqlDatabase
  }

  interface DatabaseConfig {
    mysql?: PoolConfig
  }
}

export interface MysqlDatabaseConfig extends PoolConfig {}

export const arrayTypes: string[] = []

const defaultConfig: MysqlDatabaseConfig = {
  typeCast (field, next) {
    const identifier = `${field.table}.${field.name}`
    if (arrayTypes.includes(identifier)) {
      const source = field.string()
      return source ? source.split(',') : []
    }
    if (field.type === 'JSON') {
      return JSON.parse(field.string())
    } else if (field.type === 'BIT') {
      return Boolean(field.buffer()?.readUInt8(0))
    } else {
      return next()
    }
  },
}

export function includes (key: string, value: string) {
  key = escapeId(key)
  value = escape(value).slice(1, -1)
  return `${key} LIKE '${value}' OR ${key} LIKE '%,${value}' OR ${key} LIKE '${value},%' OR ${key} LIKE '%,${value},%'`
}

export interface OkPacket {
  fieldCount: number
  affectedRows: number
  insertId: number
  serverStatus: number
  warningCount: number
  message: string
  protocol41: boolean
  changedRows: number
}

export class MysqlDatabase implements AbstractDatabase {
  public pool: Pool
  public config: MysqlDatabaseConfig
  public identifier: string

  escape = escape
  escapeId = escapeId

  static identify (config: MysqlDatabaseConfig) {
    return (config.host || 'localhost') + (config.port || 3306) + config.user + config.database
  }

  constructor (config: MysqlDatabaseConfig) {
    this.config = {
      ...defaultConfig,
      ...config,
    }
  }

  async start () {
    this.pool = createPool(this.config)
  }

  joinKeys = (keys: readonly string[]) => {
    return keys.map(key => `\`${key}\``).join(',')
  }

  formatValues = (prefix: string, data: object, keys: readonly string[]) => {
    return keys.map((key) => {
      if (typeof data[key] !== 'object' || types.isDate(data[key])) return data[key]
      const identifier = `${prefix}.${key}`
      if (arrayTypes.includes(identifier)) return data[key].join(',')
      return JSON.stringify(data[key])
    })
  }

  query = <T extends {}> (sql: string, values?: any): Promise<T> => {
    return new Promise((resolve, reject) => {
      this.pool.query(sql, values, (error, results, fields) => {
        if (error) {
          reject(error)
        } else {
          resolve(results)
        }
      })
    })
  }

  select = <T extends {}> (table: string, fields: readonly string[], conditional?: string, values: readonly any[] = []) => {
    return this.query<T>(`SELECT ${this.joinKeys(fields)} FROM ?? ${conditional ? ' WHERE ' + conditional : ''}`, [table, ...values])
  }

  async create <K extends TableType> (table: K, data: Partial<TableData[K]>): Promise<TableData[K]> {
    const keys = Object.keys(data)
    if (!keys.length) return
    const header = await this.query<OkPacket>(
      `INSERT INTO ?? (${this.joinKeys(keys)}) VALUES (${'?, '.repeat(keys.length - 1)}?)`,
      [table, ...this.formatValues(table, data, keys)],
    )
    return { ...data, id: header.insertId } as any
  }

  async update <K extends TableType> (table: K, id: number | string, data: Partial<TableData[K]>) {
    const keys = Object.keys(data)
    if (!keys.length) return
    const header = await this.query(
      'UPDATE ?? SET ' + keys.map(key => `\`${key}\` = ?`).join(', ') + ' WHERE `id` = ?',
      [table, ...this.formatValues(table, data, keys), id],
    )
    return header as OkPacket
  }

  async count <K extends TableType> (table: K) {
    const [{ 'COUNT(*)': count }] = await this.query('SELECT COUNT(*) FROM ??', [table])
    return count as number
  }

  stop () {
    this.pool.end()
  }
}

registerDatabase('mysql', MysqlDatabase)
