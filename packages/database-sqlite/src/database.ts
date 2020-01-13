import { registerDatabase, AbstractDatabase, TableType, TableData } from 'koishi-core'
import { Database } from 'sqlite3'
import { types } from 'util'

declare module 'koishi-core/dist/database' {
  interface Subdatabases {
    sqlite: SqliteDatabase
  }

  interface DatabaseConfig {
    sqlite: SqliteConfig
  }
}

export interface SqliteConfig {
  path: string
}

export const arrayTypes: string[] = []
export const jsonTypes: string[] = []

export type Pragma = {
  [K in TableType]: Record<keyof TableData[K], string>
}

export const pragma: Pragma = {
  user: {
    id: 'BIGINT',
    name: 'VARCHAR(64)',
    flag: 'INT',
    authority: 'INT',
    usage: 'TEXT',
  },
  group: {
    id: 'BIGINT',
    assignee: 'BIGINT',
    flag: 'INT',
  },
}

function typeCast <T> (table: string, source: T) {
  const result = {} as T
  for (const key in source) {
    const value = source[key] as any
    const identifier = `${table}.${key}`
    if (arrayTypes.includes(identifier)) {
      result[key] = value ? value.split(',') : []
    } else if (jsonTypes.includes(identifier)) {
      result[key] = JSON.parse(value)
    } else {
      result[key] = value
    }
  }
  return result
}

export class SqliteDatabase implements AbstractDatabase {
  public db: Database
  public identifier: string

  constructor (public config: SqliteConfig) {
    this.db = new Database(config.path)
    this.identifier = config.path
  }

  async start () {
    await Promise.all(Object.keys(pragma).map(async (table) => {
      const data = await this.all(`PRAGMA table_info("${table}")`)
      if (!data.length) return this.get(`CREATE TABLE "${table}" (${Object.entries(pragma[table]).map(([key, type]) => `${key} ${type}`).join(', ')})`)
    }))
  }

  joinKeys (keys: readonly string[]) {
    if (!keys.length) return '*'
    return keys.map(key => `\`${key}\``).join(',')
  }

  formatValues (prefix: string, data: object, keys: readonly string[]) {
    return keys.map((key) => {
      if (typeof data[key] !== 'object' || types.isDate(data[key])) return data[key]
      const identifier = `${prefix}.${key}`
      if (arrayTypes.includes(identifier)) return data[key].join(',')
      return JSON.stringify(data[key])
    })
  }

  get <T> (sql: string, values?: any): Promise<T> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, values, function (error, row) {
        return error ? reject(error) : resolve(row)
      })
    })
  }

  all <T> (sql: string, values?: any): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, values, function (error, rows) {
        return error ? reject(error) : resolve(rows)
      })
    })
  }

  async select <T> (table: string, fields: readonly string[] = [], conditional?: string, values: readonly any[] = []) {
    const data = await this.all<T>(`SELECT ${this.joinKeys(fields)} FROM "${table}" ${conditional ? ' WHERE ' + conditional : ''}`, values)
    return data.map(d => typeCast(table, d))
  }

  async update (table: string, id: number | string, data: object) {
    const keys = Object.keys(data)
    if (!keys.length) return
    const header = await this.get(
      `UPDATE "${table}" SET ` + keys.map(key => `\`${key}\` = ?`).join(', ') + ' WHERE `id` = ' + id,
      this.formatValues(table, data, keys),
    )
    return header
  }

  async count (table: string) {
    const data = await this.get(`SELECT COUNT(*) FROM "${table}"`)
    return data['COUNT(*)'] as number
  }

  stop () {
    this.db.close()
  }
}

registerDatabase('sqlite', SqliteDatabase)
