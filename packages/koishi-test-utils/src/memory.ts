import { createUser, createGroup, Tables, TableType, App, extendDatabase } from 'koishi-core'

declare module 'koishi-core/dist/database' {
  interface Database extends MemoryDatabase {}
}

function clone <T> (source: T): T {
  return JSON.parse(JSON.stringify(source))
}

export interface MemoryConfig {}

export class MemoryDatabase {
  store: { [T in TableType]?: Tables[T][] } = {}

  constructor (public app: App, public config: MemoryConfig) {}

  private table <K extends TableType> (table: K) {
    return this.store[table] || (this.store[table] = [])
  }

  async create <K extends TableType> (table: K, data: Partial<Tables[K]>) {
    const store = this.table(table)
    if (typeof data.id !== 'number') {
      let index = 1
      while (index in store) index++
      data.id = index
    }
    return store[data.id] = data as Tables[K]
  }

  async remove <K extends TableType> (table: K, id: number) {
    delete this.table(table)[id]
  }

  async update <K extends TableType> (table: K, id: number, data: Partial<Tables[K]>) {
    Object.assign(this.table(table)[id], clone(data))
  }

  async count (table: TableType) {
    return Object.keys(this.table(table)).length
  }
}

extendDatabase(MemoryDatabase, {
  async getUser (userId: number, authority?: any) {
    authority = typeof authority === 'number' ? authority : 0
    const data = this.store.user[userId]
    if (data) return clone(data)
    if (authority < 0) return null
    const fallback = createUser(userId, authority)
    if (authority) this.store.user[userId] = fallback
    return clone(fallback)
  },

  async getUsers (...args: any[][]) {
    if (args.length > 1 || args.length && typeof args[0][0] !== 'string') {
      return Object.keys(this.store.user)
        .filter(id => args[0].includes(+id))
        .map(id => clone(this.store.user[id]))
    } else {
      return Object.values(this.store.user)
    }
  },

  async setUser (userId: number, data: any) {
    return this.update('user', userId, data)
  },

  async getGroup (groupId: number, selfId: any) {
    selfId = typeof selfId === 'number' ? selfId : 0
    const data = this.store.group[groupId]
    if (data) return clone(data)
    const fallback = createGroup(groupId, selfId)
    if (selfId && groupId) this.store.group[groupId] = fallback
    return clone(fallback)
  },

  async getAllGroups (...args: any[][]) {
    const assignees = args.length > 1 ? args[1]
      : args.length && typeof args[0][0] === 'number' ? args[0] as never
        : await this.app.getSelfIds()
    if (!assignees.length) return []
    return Object.keys(this.store.group)
      .filter(id => assignees.includes(this.store.group[id].assignee))
      .map(id => clone(this.store.group[id]))
  },

  async setGroup (groupId: number, data: any) {
    return this.update('group', groupId, data)
  },
})

export function apply (app: App, config: MemoryConfig = {}) {
  app.database = new MemoryDatabase(app, config) as any
}
