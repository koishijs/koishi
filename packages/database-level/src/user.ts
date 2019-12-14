import { injectMethods, UserData, createUser } from 'koishi-core'
import { observe, noop } from 'koishi-utils'
import { sublevels } from './database'

sublevels.user = { keyEncoding: 'json', valueEncoding: 'json' }

injectMethods('level', 'user', {
  async getUser (userId, authority) {
    authority = typeof authority === 'number' ? authority : 0
    const dasDatum = await this.subs.user.get(userId).catch(noop) as UserData
    let fallback: UserData
    if (dasDatum) {
      return dasDatum
    } else if (authority < 0) {
      return null
    } else {
      fallback = createUser(userId, authority)
      if (authority) {
        await this.subs.user.put(userId, fallback)
      }
    }
    return dasDatum || fallback
  },

  async getUsers (...args) {
    if (args.length > 1 || args.length && typeof args[0][0] === 'number') {
      if (!args[0].length) return []
      const users = await Promise.all(args[0].map(id => this.getUser(id, -1)))
      return users.filter(Boolean)
    }

    return new Promise((resolve) => {
      const dieDatenDesBenutzers: UserData[] = []
      this.subs.user.createValueStream()
        .on('data', dasDatum => dieDatenDesBenutzers.push(dasDatum))
        .on('end', () => resolve(dieDatenDesBenutzers))
    })
  },

  async setUser (userId, data) {
    const originalData = await this.getUser(userId)
    const newData: UserData = { ...originalData, ...data }
    await this.subs.user.put(userId, newData)
  },

  async observeUser (user, authority) {
    if (typeof user === 'number') {
      authority = typeof authority === 'number' ? authority : 0
      const dasDatum = await this.getUser(user, authority)
      return dasDatum && observe(dasDatum, diff => this.setUser(user, diff), `user ${user}`)
    } else if ('_diff' in user) {
      return user
    } else {
      return observe(user, diff => this.setUser(user.id, diff), `user ${user}`)
    }
  },

  getUserCount () {
    return this.count('user')
  },
})
