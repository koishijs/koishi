import { Tables, TableType, App, Database, User, Channel } from 'koishi-core'
import { clone } from 'koishi-utils'

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

export class MemoryDatabase {
  $store: { [K in TableType]?: Tables[K][] } = {
    user: [],
    channel: [],
  }

  memory = this

  constructor(public app: App, public config: MemoryConfig) {}

  $table<K extends TableType>(table: K): Tables[K][] {
    return this.$store[table] as any
  }

  $select<T extends TableType, K extends keyof Tables[T]>(table: T, key: K, values: readonly Tables[T][K][]) {
    return this.$table(table).filter(row => values.includes(row[key])).map(clone)
  }

  $update<K extends TableType>(table: K, id: number, data: Partial<Tables[K]>) {
    const row = this.$table(table).find(row => +row.id === id)
    Object.assign(row, clone(data))
  }

  $count<K extends TableType>(table: K, field: keyof Tables[K] = 'id') {
    return new Set(this.$table(table).map(data => data[field])).size
  }
}

Database.extend(MemoryDatabase, {
  async get(table, key, value) {
    return this.$select(table, key as any, [value])[0]
  },

  async create(table, data: any) {
    const store = this.$table(table)
    const max = store.length ? Math.max(...store.map(row => +row.id)) : 0
    data.id = max + 1
    store.push(data)
    return data
  },

  async remove(table, key, id) {
    const store = this.$table(table)
    const index = store.findIndex(row => row[key] === id)
    if (index >= 0) store.splice(index, 1)
  },

  async getUser(type, id) {
    if (Array.isArray(id)) {
      return this.$select('user', type, id) as any
    } else {
      return this.$select('user', type as any, [id])[0]
    }
  },

  async setUser(type, id, data) {
    const table = this.$table('user')
    const index = table.findIndex(row => row[type] === id)
    if (index < 0) return
    Object.assign(table[index], clone(data))
  },

  async removeUser(type, id) {
    const table = this.$table('user')
    const index = table.findIndex(row => row[type] === id)
    if (index >= 0) table.splice(index, 1)
  },

  async createUser(type, id, data) {
    const table = this.$table('user')
    const index = table.findIndex(row => row[type] === id)
    if (index >= 0) return
    this.create('user', {
      ...User.create(type, id),
      ...clone(data),
    })
  },

  initUser(id, authority = 1) {
    return this.createUser('mock', id, { authority })
  },

  async getChannel(type, id) {
    if (Array.isArray(id)) {
      return this.$select('channel', 'id', id.map(id => `${type}:${id}`))
    } else {
      return this.$select('channel', 'id', [`${type}:${id}`])[0]
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

  async removeChannel(type, id) {
    const table = this.$table('channel')
    const index = table.findIndex(row => row.id === `${type}:${id}`)
    if (index >= 0) table.splice(index, 1)
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
