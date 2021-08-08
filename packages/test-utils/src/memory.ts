import { Tables, TableType, App, Database, User, Channel, Query, clone, pick } from 'koishi'

declare module 'koishi' {
  interface Database {
    memory: MemoryDatabase
    initUser(id: string, authority?: number): Promise<void>
    initChannel(id: string, assignee?: string): Promise<void>
  }

  namespace Database {
    interface Statics {
      '@koishijs/test-utils': typeof MemoryDatabase
    }
  }
}

export interface MemoryConfig {}

export interface MemoryDatabase extends Database {}

interface TableConfig<O> {
  primary?: keyof O
}

export class MemoryDatabase {
  $store: { [K in TableType]?: Tables[K][] } = {}

  memory = this

  static tables: { [K in TableType]?: TableConfig<Tables[K]> } = {}

  constructor(public app: App, public config: MemoryConfig) {}

  $table<K extends TableType>(table: K): any[] {
    return this.$store[table] ||= []
  }

  $count<K extends TableType>(table: K, field: keyof Tables[K] = 'id') {
    return new Set(this.$table(table).map(data => data[field])).size
  }
}

const queryOperators: ([string, (data: any, value: any) => boolean])[] = Object.entries({
  $regex: (data: RegExp, value) => data.test(value),
  $regexFor: (data, value) => new RegExp(value, 'i').test(data),
  $in: (data: any[], value) => data.includes(value),
  $nin: (data: any[], value) => !data.includes(value),
  $ne: (data, value) => value !== data,
  $eq: (data, value) => value === data,
  $gt: (data, value) => value > data,
  $gte: (data, value) => value >= data,
  $lt: (data, value) => value < data,
  $lte: (data, value) => value <= data,
})

Database.extend(MemoryDatabase, {
  async get(name, query, modifier) {
    function executeQuery(query: Query.Expr, data: any): boolean {
      const entries: [string, any][] = Object.entries(query)
      return entries.every(([key, value]) => {
        if (key === '$and') {
          return (value as Query.Expr[]).reduce((prev, query) => prev && executeQuery(query, data), true)
        } else if (key === '$or') {
          return (value as Query.Expr[]).reduce((prev, query) => prev || executeQuery(query, data), false)
        } else if (key === '$not') {
          return !executeQuery(value, data)
        } else if (Array.isArray(value)) {
          return value.includes(data[key])
        } else if (value instanceof RegExp) {
          return value.test(data[key])
        } else if (typeof value === 'string' || typeof value === 'number') {
          return value === data[key]
        }
        return queryOperators.reduce((prev, [prop, callback]) => {
          return prev && (prop in value ? callback(value[prop], data[key]) : true)
        }, true)
      })
    }

    const expr = Query.resolve(name, query)
    const { fields, limit = Infinity, offset = 0 } = Query.resolveModifier(modifier)
    return this.$table(name)
      .filter(row => executeQuery(expr, row))
      .map(row => clone(pick(row, fields)))
      .slice(offset, offset + limit)
  },

  async remove(name, query) {
    const entries = Object.entries(Query.resolve(name, query))
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
    }).map(row => clone(pick(row, fields)))
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
}
