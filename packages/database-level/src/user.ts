import { injectMethods, UserData, createUser, User } from 'koishi-core'
import { observe, noop } from 'koishi-utils'
import {} from './database'

injectMethods('level', 'user', {
  async getUser (userId, authority) {
    authority = typeof authority === 'number' ? authority : 0
    const data = await this.tables.user.get(userId).catch(noop) as UserData
    if (data) return data
    if (authority < 0) return null
    const fallback = createUser(userId, authority)
    if (authority) {
      await this.tables.user.put(userId, fallback)
    }
    return fallback
  },

  async getUsers (...args) {
    if (args.length > 1 || args.length && typeof args[0][0] !== 'string') {
      if (!args[0].length) return []
      const users = await Promise.all(args[0].map(id => this.tables.user.get(id).catch(noop)))
      return users.filter(Boolean) as UserData[]
    }

    return new Promise((resolve) => {
      const dieDatenDesBenutzers: UserData[] = []
      this.tables.user.createValueStream()
        .on('data', dasDatum => dieDatenDesBenutzers.push(dasDatum))
        .on('end', () => resolve(dieDatenDesBenutzers))
    })
  },

  async setUser (userId, data) {
    return this.update('user', userId, data)
  },
})
