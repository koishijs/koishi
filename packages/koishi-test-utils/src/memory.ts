import { User, Group, Tables, TableType, App, extendDatabase } from 'koishi-core'
import { clone } from 'koishi-utils'

declare module 'koishi-core/dist/database' {
  interface Database extends MemoryDatabase {}
}

export interface MemoryConfig {}

export class MemoryDatabase {
  $store: Record<string, Record<number, any>> = {}

  constructor(public app: App, public config: MemoryConfig) {}

  $table<K extends TableType>(table: K): Record<number, Tables[K]> {
    return this.$store[table] || (this.$store[table] = {})
  }

  $create<K extends TableType>(table: K, data: Partial<Tables[K]>, key = 'id') {
    const store = this.$table(table)
    if (typeof data[key] !== 'number') {
      let index = 1
      while (index in store) index++
      data[key] = index
    }
    return store[data[key]] = data as Tables[K]
  }

  $remove<K extends TableType>(table: K, id: number) {
    delete this.$table(table)[id]
  }

  $update<K extends TableType>(table: K, id: number, data: Partial<Tables[K]>) {
    Object.assign(this.$table(table)[id], clone(data))
  }

  $count<K extends TableType>(table: K, field?: keyof Tables[K]) {
    if (!field) return Object.keys(this.$table(table)).length
    return new Set(Object.values(this.$table(table)).map(data => data[field])).size
  }
}

extendDatabase(MemoryDatabase, {
  async getUser(type, userId: number) {
    const table = this.$table('user')
    const data = table[userId]
    if (data) return clone(data)
  },

  async getUsers(type, ...args: any[][]) {
    const table = this.$table('user')
    if (args.length > 1 || args.length && typeof args[0][0] !== 'string') {
      return Object.keys(table)
        .filter(id => args[0].includes(+id))
        .map(id => clone(table[id]))
    } else {
      return Object.values(table)
    }
  },

  async setUser(type, userId: number, data: any) {
    return this.$update('user', userId, data)
  },

  async getGroup(type, groupId: number) {
    const table = this.$table('group')
    const data = table[groupId]
    if (data) return clone(data)
  },

  async getAllGroups(...args: any[][]) {
    const table = this.$table('group')
    const assignees = args.length > 1 ? args[1]
      : args.length && typeof args[0][0] === 'number' ? args[0] as never
        : await this.app.getSelfIds()
    if (!assignees.length) return []
    return Object.keys(table)
      .filter(id => assignees.includes(table[id].assignee))
      .map(id => clone(table[id]))
  },

  async setGroup(type, groupId: number, data: any) {
    return this.$update('group', groupId, data)
  },
})

export function apply(app: App, config: MemoryConfig = {}) {
  app.database = new MemoryDatabase(app, config) as any
}
