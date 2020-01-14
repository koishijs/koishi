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
}

registerDatabase('memory', MemoryDatabase)

function clone <T> (source: T): T {
  return JSON.parse(JSON.stringify(source))
}

injectMethods('memory', 'user', {
  async getUser (userId, authority) {
    authority = typeof authority === 'number' ? authority : 0
    const data = this.store.user.find(u => u.id === userId)
    if (data) return clone(data)
    if (authority < 0) return null
    const fallback = createUser(userId, authority)
    if (authority) this.store.user.push(fallback)
    return clone(fallback)
  },

  async getUsers (...args) {
    if (args.length > 1 || args.length && typeof args[0][0] !== 'string') {
      return this.store.user.filter(u => args[0].includes(u.id)).map(clone)
    } else {
      return this.store.user.slice()
    }
  },

  async setUser (userId, data) {
    Object.assign(this.store.user.find(u => u.id === userId), clone(data))
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

  async getUserCount () {
    return this.store.user.length
  },
})

injectMethods('memory', 'group', {
  async getGroup (groupId, selfId) {
    selfId = typeof selfId === 'number' ? selfId : 0
    const data = this.store.group.find(g => g.id === groupId)
    if (data) return clone(data)
    const fallback = createGroup(groupId, selfId)
    if (selfId && groupId) this.store.group.push(fallback)
    return clone(fallback)
  },

  async getAllGroups (...args) {
    const assignees = args.length > 1 ? args[1]
      : args.length && typeof args[0][0] === 'number' ? args[0] as never
        : await getSelfIds()
    if (!assignees.length) return []
    return this.store.group.filter(g => assignees.includes(g.assignee)).map(clone)
  },

  async setGroup (groupId, data) {
    Object.assign(this.store.group.find(u => u.id === groupId), clone(data))
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

  async getGroupCount () {
    return this.store.group.length
  },
})
