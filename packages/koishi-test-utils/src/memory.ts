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

  $create<K extends TableType>(table: K, data: Partial<Tables[K]>) {
    const store = this.$table(table)
    if (typeof data.id !== 'number') {
      let index = 1
      while (index in store) index++
      data.id = index
    }
    return store[data.id] = data as Tables[K]
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
  async getUser(userId: number, authority?: any) {
    const table = this.$table('user')
    authority = typeof authority === 'number' ? authority : 0
    const data = table[userId]
    if (data) return clone(data)
    if (authority < 0) return null
    const fallback = User.create(userId, authority)
    if (authority) table[userId] = fallback
    return clone(fallback)
  },

  async getUsers(...args: any[][]) {
    const table = this.$table('user')
    if (args.length > 1 || args.length && typeof args[0][0] !== 'string') {
      return Object.keys(table)
        .filter(id => args[0].includes(+id))
        .map(id => clone(table[id]))
    } else {
      return Object.values(table)
    }
  },

  async setUser(userId: number, data: any) {
    return this.$update('user', userId, data)
  },

  async getGroup(groupId: number, selfId: any) {
    const table = this.$table('group')
    selfId = typeof selfId === 'number' ? selfId : 0
    const data = table[groupId]
    if (data) return clone(data)
    if (selfId < 0) return null
    const fallback = Group.create(groupId, selfId)
    if (selfId) table[groupId] = fallback
    return clone(fallback)
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

  async setGroup(groupId: number, data: any) {
    return this.$update('group', groupId, data)
  },
})

export function apply(app: App, config: MemoryConfig = {}) {
  app.database = new MemoryDatabase(app, config) as any
}
