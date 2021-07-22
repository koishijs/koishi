import { Tables, TableType, App, Database, User, Channel } from 'koishi-core'
import { clone, pick } from 'koishi-utils'

declare module 'koishi-core' {
  interface Database {
    memory: MemoryDatabase
    initUser(id: string, authority?: number): Promise<void>
    initChannel(id: string, assignee?: string): Promise<void>
  }

  namespace Database {
    interface Statics {
      'koishi-test-utils': typeof MemoryDatabase
    }
  }
}

export interface MemoryConfig {}

export interface MemoryDatabase extends Database {}

interface TableConfig<O> {
  primary?: keyof O
}

export class MemoryDatabase {
  $store: { [K in TableType]?: Tables[K][] } = {
    user: [],
    channel: [],
  }

  memory = this

  static tables: { [K in TableType]?: TableConfig<Tables[K]> } = {}

  constructor(public app: App, public config: MemoryConfig) {}

  $table<K extends TableType>(table: K): any[] {
    return this.$store[table]
  }

  $count<K extends TableType>(table: K, field: keyof Tables[K] = 'id') {
    return new Set(this.$table(table).map(data => data[field])).size
  }
}

Database.extend(MemoryDatabase, {
  async get(name, query, fields) {
    const entries = Object.entries(Tables.resolveQuery(name, query))
    return this.$table(name)
      .filter(row => {
        const and = (entries: [string, any][]): boolean => {
          return entries.every(([key, value]) => {
            if (key === '$or') {
              return value
                .map(item => and(Object.entries(Tables.resolveQuery(name, item))))
                .reduce((a, b) => a || b)
            }
            if (Array.isArray(value)) {
              return value.includes(row[key])
            }
            if (value instanceof RegExp) {
              return value.test(row[key])
            }
            return Object.entries({
              $regex: value['$regex']
                ? value['$regex'].test(row[key])
                : true,
              $in: value['$in']
                ? value['$in'].includes(row[key])
                : true,
              $nin: value['$nin']
                ? !value['$nin'].includes(row[key])
                : true,
              $ne: row[key] !== value['$ne'],
              $eq: row[key] === value['$eq'],
              $gt: row[key] > value['$gt'],
              $gte: row[key] >= value['$gte'],
              $lt: row[key] < value['$lt'],
              $lte: row[key] <= value['$lte'],
            })
              .map(([operate, result]) => value[operate] === undefined ? true : result)
              .reduce((a, b) => a && b)
          })
        }
        return and(entries)
      })
      .map(row => fields ? pick(row, fields) : row)
      .map(clone)
  },

  async remove(name, query) {
    const entries = Object.entries(Tables.resolveQuery(name, query))
    this.$store[name] = this.$table(name)
      .filter(row => !entries.every(([key, value]) => value.includes(row[key])))
  },

  async create(table, data: any) {
    const store = this.$table(table)
    const { primary = 'id' } = MemoryDatabase.tables[table] || {}
    if (!data[primary]) {
      const max = store.length ? Math.max(...store.map(row => +row[primary])) : 0
      data[primary] = max + 1
    }
    store.push(data)
    return data
  },

  async update(table, data, key: string) {
    if (key) key = (MemoryDatabase.tables[table] || {}).primary || 'id'
    for (const item of data) {
      const row = this.$table(table).find(row => row[key] === item[key])
      Object.assign(row, clone(item))
    }
  },

  async getUser(type, id, fields) {
    if (Array.isArray(id)) {
      return this.get('user', { [type]: id }, fields) as any
    } else {
      return (await this.get('user', { [type]: [id] }, fields))[0]
    }
  },

  async setUser(type, id, data) {
    const table = this.$table('user')
    const index = table.findIndex(row => row[type] === id)
    if (index < 0) return
    Object.assign(table[index], clone(data))
  },

  async createUser(type, id, data) {
    const table = this.$table('user')
    const index = table.findIndex(row => row[type] === id)
    if (index >= 0) return
    const user = await this.create('user', {
      ...User.create(type, id),
      ...clone(data),
    })
    user.id = '' + user.id
  },

  initUser(id, authority = 1) {
    return this.createUser('mock', id, { authority })
  },

  async getChannel(type, id, fields) {
    if (Array.isArray(id)) {
      return this.get('channel', id.map(id => `${type}:${id}`), fields)
    } else {
      return (await this.get('channel', [`${type}:${id}`], fields))[0]
    }
  },

  async getAssignedChannels(fields, assignMap = this.app.getSelfIds()) {
    return this.$table('channel').filter((row) => {
      const [type] = row.id.split(':')
      return assignMap[type]?.includes(row.assignee)
    })
  },

  async setChannel(type, id, data) {
    const table = this.$table('channel')
    const index = table.findIndex(row => row.id === `${type}:${id}`)
    if (index < 0) return
    Object.assign(table[index], clone(data))
  },

  async createChannel(type, id, data) {
    const table = this.$table('channel')
    const index = table.findIndex(row => row.id === `${type}:${id}`)
    if (index >= 0) return
    table.push({
      ...Channel.create(type, id),
      ...clone(data),
    })
  },

  initChannel(id, assignee = this.app.bots[0].selfId) {
    return this.createChannel('mock', id, { assignee })
  },
})

export function apply(app: App, config: MemoryConfig = {}) {
  app.database = new MemoryDatabase(app, config) as any

  const originalTablesExtend = Tables.extend
  Tables.extend = <T>(name, meta) => {
    app.database.memory.$store[name] = []
    return originalTablesExtend.apply(Tables, [name, meta])
  }
}
