import { createPool, Pool, PoolConfig, escape, escapeId, format, OkPacket } from 'mysql'
import { TableType, Tables, App } from 'koishi-core'
import { Logger } from 'koishi-utils'
import { types } from 'util'

const logger = Logger.create('mysql')

export interface Config extends PoolConfig {}

export default class MysqlDatabase {
  static listFields: string[] = []

  public pool: Pool
  public config: Config

  escape = escape
  escapeId = escapeId

  constructor(public app: App, config: Config) {
    this.config = {
      ...config,
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
    }
  }

  async start() {
    this.pool = createPool(this.config)
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

    return new Promise((resolve, reject) => {
      const sql = format(source, values)
      logger.debug('[sql]', sql)
      this.pool.query(sql, (error, results) => {
        if (error) {
          reject(error)
        } else {
          resolve(results)
        }
      })
    })
  }

  select<T extends {}>(table: string, fields: readonly string[], conditional?: string, values: readonly any[] = []) {
    logger.debug(`[select] ${table}: ${fields ? fields.join(', ') : '*'}`)
    return this.query<T>(`SELECT ${this.joinKeys(fields)} FROM \`${table}\` _${table} ${conditional ? ' WHERE ' + conditional : ''}`, values)
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
