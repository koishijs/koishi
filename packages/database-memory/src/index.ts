import { injectMethods, TableType, TableData, createUser, User, createGroup, getSelfIds, Group, InjectConfig, registerDatabase } from 'koishi-core'
import { observe } from 'koishi-utils'

declare module 'koishi-core/dist/database' {
  interface Subdatabases {
    memory: MemoryDatabase
  }

  interface DatabaseConfig {
    memory?: MemoryConfig
  }
}

interface MemoryConfig {}

export class MemoryDatabase {
  store: { [T in TableType]?: TableData[T][] } = {}

  constructor (public config: MemoryConfig, public injectConfig: InjectConfig<'memory'>) {}

  start () {
    for (const key in this.injectConfig) {
      this.store[key] = []
    }
  }

  async create <K extends TableType> (table: K, data: Partial<TableData[K]>) {
    const store = this.store[table]
    if (typeof data.id !== 'number') {
      let index = 1
      while (index in store) index++
      data.id = index
    }
    return store[data.id] = data as TableData[K]
  }

  async remove <K extends TableType> (table: K, id: number) {
    delete this.store[table][id]
  }

  async update <K extends TableType> (table: K, id: number, data: Partial<TableData[K]>) {
    Object.assign(this.store[table][id], clone(data))
  }

  async count (table: TableType) {
    return Object.keys(this.store[table]).length
  }
}

registerDatabase('memory', MemoryDatabase)

function clone <T> (source: T): T {
  return JSON.parse(JSON.stringify(source))
}

injectMethods('memory', 'user', {
  async getUser (userId, authority) {
    authority = typeof authority === 'number' ? authority : 0
    const data = this.store.user[userId]
    if (data) return clone(data)
    if (authority < 0) return null
    const fallback = createUser(userId, authority)
    if (authority) this.store.user[userId] = fallback
    return clone(fallback)
  },

  async getUsers (...args) {
    if (args.length > 1 || args.length && typeof args[0][0] !== 'string') {
      return Object.keys(this.store.user)
        .filter(id => args[0].includes(+id))
        .map(id => clone(this.store.user[id]))
    } else {
      return Object.values(this.store.user)
    }
  },

  async setUser (userId, data) {
    return this.update('user', userId, data)
  },

  async observeUser (user, authority) {
    if (typeof user === 'number') {
      const data = await this.getUser(user, authority)
      return data && observe(clone(data), diff => this.setUser(user, diff), `user ${user}`)
    }

    const data = await this.getUser(user.id, authority)
    if ('_diff' in user) return (user as User)._merge(clone(data))
    return observe(Object.assign(user, clone(data)), diff => this.setUser(user.id, diff), `user ${user.id}`)
  },
})

injectMethods('memory', 'group', {
  async getGroup (groupId, selfId) {
    selfId = typeof selfId === 'number' ? selfId : 0
    const data = this.store.group[groupId]
    if (data) return clone(data)
    const fallback = createGroup(groupId, selfId)
    if (selfId && groupId) this.store.group[groupId] = fallback
    return clone(fallback)
  },

  async getAllGroups (...args) {
    const assignees = args.length > 1 ? args[1]
      : args.length && typeof args[0][0] === 'number' ? args[0] as never
        : await getSelfIds()
    if (!assignees.length) return []
    return Object.keys(this.store.group)
      .filter(id => assignees.includes(this.store.group[id].assignee))
      .map(id => clone(this.store.group[id]))
  },

  async setGroup (groupId, data) {
    return this.update('group', groupId, data)
  },

  async observeGroup (group, selfId) {
    if (typeof group === 'number') {
      const data = await this.getGroup(group, selfId)
      return data && observe(clone(data), diff => this.setGroup(group, diff), `group ${group}`)
    }

    const data = await this.getGroup(group.id, selfId)
    if ('_diff' in group) return (group as Group)._merge(clone(data))
    return observe(Object.assign(group, clone(data)), diff => this.setGroup(group.id, diff), `group ${group.id}`)
  },
})
