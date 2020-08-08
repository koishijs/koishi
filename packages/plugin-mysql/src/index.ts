import { createPool, Pool, PoolConfig, escape, escapeId, format, OkPacket } from 'mysql'
import { TableType, Tables, App, User, Group, Database, extendDatabase, Context } from 'koishi-core'
import { Logger } from 'koishi-utils'
import { types } from 'util'

const logger = Logger.create('mysql')

declare module 'koishi-core/dist/database' {
  interface Database extends MysqlDatabase {}
}

export interface Options extends PoolConfig {}

export const arrayTypes: string[] = []

const defaultConfig: Options = {
  typeCast (field, next) {
    const identifier = `${field['packet'].orgTable}.${field.name}`
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

export const userGetters: Record<string, () => string> = {}

function inferFields (keys: readonly string[]) {
  return keys.map(key => key in userGetters ? `${userGetters[key]()} AS ${key}` : key) as User.Field[]
}

export default class MysqlDatabase {
  public pool: Pool
  public config: Options

  escape = escape
  escapeId = escapeId

  constructor (public app: App, config: Options) {
    this.config = {
      ...defaultConfig,
      ...config,
    }
  }

  async start () {
    this.pool = createPool(this.config)
  }

  joinKeys = (keys: readonly string[]) => {
    return keys ? keys.map(key => key.includes('`') ? key : `\`${key}\``).join(',') : '*'
  }

  formatValues = (prefix: string, data: object, keys: readonly string[]) => {
    return keys.map((key) => {
      if (typeof data[key] !== 'object' || types.isDate(data[key])) return data[key]
      const identifier = `${prefix}.${key}`
      if (arrayTypes.includes(identifier)) return data[key].join(',')
      return JSON.stringify(data[key])
    })
  }

  query = <T extends {}> (source: string, values?: any): Promise<T> => {
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

  select = <T extends {}> (table: string, fields: readonly string[], conditional?: string, values: readonly any[] = []) => {
    logger.debug(`[select] ${table}: ${fields ? fields.join(', ') : '*'}`)
    return this.query<T>(`SELECT ${this.joinKeys(fields)} FROM \`${table}\` _${table} ${conditional ? ' WHERE ' + conditional : ''}`, values)
  }

  async create <K extends TableType> (table: K, data: Partial<Tables[K]>): Promise<Tables[K]> {
    const keys = Object.keys(data)
    if (!keys.length) return
    logger.debug(`[create] ${table}: ${data}`)
    const header = await this.query<OkPacket>(
      `INSERT INTO ?? (${this.joinKeys(keys)}) VALUES (${keys.map(_ => '?').join(', ')})`,
      [table, ...this.formatValues(table, data, keys)],
    )
    return { ...data, id: header.insertId } as any
  }

  async update <K extends TableType> (table: K, data: Partial<Tables[K]>[]): Promise<OkPacket>
  async update <K extends TableType> (table: K, id: number | string, data: Partial<Tables[K]>): Promise<OkPacket>
  async update <K extends TableType> (table: K, arg1: number | string | Tables[K][], data?: Partial<Tables[K]>) {
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

  async count <K extends TableType> (table: K, conditional?: string) {
    const [{ 'COUNT(*)': count }] = await this.query(`SELECT COUNT(*) FROM ?? ${conditional ? 'WHERE ' + conditional : ''}`, [table])
    return count as number
  }

  stop () {
    this.pool.end()
  }
}

extendDatabase(MysqlDatabase, {
  async getUser (userId, ...args) {
    const authority = typeof args[0] === 'number' ? args.shift() as number : 0
    const fields = args[0] ? inferFields(args[0] as any) : User.fields
    if (fields && !fields.length) return {} as any
    const [data] = await this.select<User[]>('user', fields, '`id` = ?', [userId])
    let fallback: User
    if (data) {
      data.id = userId
    } else if (authority < 0) {
      return null
    } else {
      fallback = User.create(userId, authority)
      if (authority) {
        await this.query(
          'INSERT INTO `user` (' + this.joinKeys(User.fields) + ') VALUES (' + User.fields.map(() => '?').join(', ') + ')',
          this.formatValues('user', fallback, User.fields),
        )
      }
    }
    return data || fallback
  },

  async getUsers (...args) {
    let ids: readonly number[], fields: readonly User.Field[]
    if (args.length > 1) {
      ids = args[0]
      fields = inferFields(args[1])
    } else if (args.length && typeof args[0][0] !== 'string') {
      ids = args[0]
      fields = User.fields
    } else {
      fields = inferFields(args[0] as any)
    }
    if (ids && !ids.length) return []
    return this.select<User[]>('user', fields, ids && `\`id\` IN (${ids.join(', ')})`)
  },

  async setUser (userId, data) {
    await this.update('user', userId, data)
  },

  async getGroup (groupId, ...args) {
    const selfId = typeof args[0] === 'number' ? args.shift() as number : 0
    const fields = args[0] as any || Group.fields
    if (fields && !fields.length) return {} as any
    const [data] = await this.select<Group[]>('group', fields, '`id` = ?', [groupId])
    let fallback: Group
    if (!data) {
      fallback = Group.create(groupId, selfId)
      if (selfId && groupId) {
        await this.query(
          'INSERT INTO `group` (' + this.joinKeys(Group.fields) + ') VALUES (' + Group.fields.map(() => '?').join(', ') + ')',
          this.formatValues('group', fallback, Group.fields),
        )
      }
    } else {
      data.id = groupId
    }
    return data || fallback
  },

  async getAllGroups (...args) {
    let assignees: readonly number[], fields: readonly Group.Field[]
    if (args.length > 1) {
      fields = args[0]
      assignees = args[1]
    } else if (args.length && typeof args[0][0] === 'number') {
      fields = Group.fields
      assignees = args[0] as any
    } else {
      fields = args[0] || Group.fields
      assignees = await this.app.getSelfIds()
    }
    if (!assignees.length) return []
    return this.select<Group[]>('group', fields, `\`assignee\` IN (${assignees.join(',')})`)
  },

  async setGroup (groupId, data) {
    await this.update('group', groupId, data)
  },
})

export const name = 'mysql'

export function apply (ctx: Context, config: Options = {}) {
  const db = new MysqlDatabase(ctx.app, config)
  ctx.database = db as Database
  ctx.on('before-connect', () => db.start())
  ctx.on('before-disconnect', () => db.stop())
}
