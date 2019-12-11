import { createPool, Pool, TypeCast, PoolConfig, escape, escapeId } from 'mysql'
import { registerDatabase } from 'koishi-core'
import { types } from 'util'

declare module 'koishi-core/dist/database' {
  interface Subdatabases {
    mysql: MysqlDatabase
  }

  interface DatabaseConfig {
    mysql: PoolConfig
  }
}

export const arrayTypes: string[] = []

export const typeCast: TypeCast = (field, next) => {
  const identifier = `${field.table}.${field.name}`
  if (arrayTypes.includes(identifier)) {
    const source = field.string()
    return source ? source.split(',') : []
  }
  if (field.type === 'JSON') {
    return JSON.parse(field.string())
  } else if (field.type === 'BIT') {
    const buffer = field.buffer()
    return Boolean(buffer && buffer.readUInt8(0))
  } else {
    return next()
  }
}

const defaultConfig = {
  typeCast,
} as PoolConfig

export function joinKeys (keys: string[]) {
  return keys.map(key => `\`${key}\``).join(',')
}

export function formatValues (prefix: string, data: object, keys: string[]) {
  return keys.map((key) => {
    if (typeof data[key] !== 'object' || types.isDate(data[key])) return data[key]
    const identifier = `${prefix}.${key}`
    if (arrayTypes.includes(identifier)) return data[key].join(',')
    return JSON.stringify(data[key])
  })
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

export class MysqlDatabase {
  public pool: Pool

  constructor (config: PoolConfig) {
    this.pool = createPool({
      ...defaultConfig,
      ...config,
    })
  }

  query = (sql: string, values?: any): Promise<any> => {
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

  create = async <T extends {}> (table: string, data: Partial<T>): Promise<T> => {
    const keys = Object.keys(data)
    if (!keys.length) return
    const header = await this.query(
      `INSERT INTO ?? (${joinKeys(keys)}) VALUES (${'?, '.repeat(keys.length - 1)}?)`,
      [table, ...formatValues(table, data, keys)],
    )
    return { ...data, id: header.insertId } as any
  }

  update = async (table: string, id: number | string, data: object) => {
    const keys = Object.keys(data)
    if (!keys.length) return
    const header = await this.query(
      'UPDATE ?? SET ' + keys.map(key => `\`${key}\` = ?`).join(', ') + ' WHERE `id` = ?',
      [table, ...formatValues(table, data, keys), id],
    )
    return header as OkPacket
  }

  count = async (table: string) => {
    const [{ 'COUNT(*)': count }] = await this.query('SELECT COUNT(*) FROM ??', [table])
    return count as number
  }
}

registerDatabase('mysql', MysqlDatabase)
