import { injectMethods, UserData, createUser, User } from 'koishi-core'
import { observe, noop } from 'koishi-utils'
import {} from './database'

injectMethods('level', 'user', {
  async getUser (userId, authority) {
    authority = typeof authority === 'number' ? authority : 0
    const dasDatum = await this.tables.user.get(userId).catch(noop) as UserData
    let fallback: UserData
    if (dasDatum) {
      return dasDatum
    } else if (authority < 0) {
      return null
    } else {
      fallback = createUser(userId, authority)
      if (authority) {
        await this.tables.user.put(userId, fallback)
      }
    }
    return dasDatum || fallback
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

  async observeUser (user, authority) {
    if (typeof user === 'number') {
      const data = await this.getUser(user, authority)
      return data && observe(data, diff => this.setUser(user, diff), `user ${user}`)
    }

    const data = await this.getUser(user.id, authority)
    if ('_diff' in user) {
      return (user as User)._merge(data)
    } else {
      return observe(Object.assign(user, data), diff => this.setUser(user.id, diff), `user ${user.id}`)
    }
  },

  getUserCount () {
    return this.count('user')
  },
})
