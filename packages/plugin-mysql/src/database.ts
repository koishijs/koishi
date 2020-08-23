import { createPool, Pool, PoolConfig, escape, escapeId, format, OkPacket } from 'mysql'
import { TableType, Tables, App } from 'koishi-core'
import { Logger } from 'koishi-utils'
import { types } from 'util'

const logger = new Logger('mysql')

export interface Config extends PoolConfig {}

type MysqlColumn = string

type MysqlTableMap = {
  [T in TableType]?: string[] & {
    [C in keyof Tables[T]]?: MysqlColumn
  }
}

export default class MysqlDatabase {
  static tables: MysqlTableMap = {}
  static listFields: string[] = []

  public pool: Pool
  public config: Config

  escape = escape
  escapeId = escapeId

  constructor(public app: App, config: Config) {
    this.config = {
      database: 'koishi',
      charset: 'utf8mb4_general_ci',
      typeCast: (field, next) => {
        const identifier = `${field['packet'].orgTable}.${field.name}`
        if (MysqlDatabase.listFields.includes(identifier)) {
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
      ...config,
    }
  }

  async start() {
    this.pool = createPool(this.config)
    const tables = await this.select('information_schema.tables', ['TABLE_NAME'], 'TABLE_SCHEMA = ?', [this.config.database])
    const names = new Set<TableType>(tables.map(data => data.TABLE_NAME))
    for (const name of Object.keys(MysqlDatabase.tables) as TableType[]) {
      if (names.has(name)) return
      const table = MysqlDatabase.tables[name]
      const cols = Object.keys(table).map((key) => {
        if (+key * 0 === +key) return table[key]
        return `\`${key}\` ${table[key]}`
      })
      logger.info('auto creating table %c', name)
      await this.query(`CREATE TABLE ?? (${cols.join(',')}) COLLATE = ?`, [name, this.config.charset])
    }
  }

  joinKeys = (keys: readonly string[]) => {
    return keys ? keys.map(key => key.includes('`') ? key : `\`${key}\``).join(',') : '*'
  }

  formatValues = (prefix: string, data: object, keys: readonly string[]) => {
    return keys.map((key) => {
      if (typeof data[key] !== 'object' || types.isDate(data[key])) return data[key]
      const identifier = `${prefix}.${key}`
      if (MysqlDatabase.listFields.includes(identifier)) return data[key].join(',')
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
        error.stack = err.message + error.stack.slice(7)
        reject(error)
      })
    })
  }

  select<T extends string>(table: string, fields: readonly (T extends string ? T : string & keyof T)[], conditional?: string, values?: readonly any[]): Promise<Record<T, any>[]>
  select<T extends {}>(table: string, fields: readonly (T extends string ? T : string & keyof T)[], conditional?: string, values?: readonly any[]): Promise<T[]>
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
      `INSERT INTO ?? (${this.joinKeys(keys)}) VALUES (${keys.map(_ => '?').join(', ')})`,
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
      const placeholder = `(${keys.map(_ => '?').join(', ')})`
      const header = await this.query(
        `INSERT INTO ?? (${this.joinKeys(keys)}) VALUES ${arg1.map(_ => placeholder).join(', ')}
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
