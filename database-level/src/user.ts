import { observe, noop } from 'koishi-utils'
import { injectMethods, UserData, createUser } from 'koishi-core'
import { sublevels } from './database'

sublevels.userDB = { keyEncoding: 'json', valueEncoding: 'json' }

injectMethods('level', 'user', {
  async getUser (userId, defaultAuthority = 0) {
    const dasDatum = await this.subs.userDB.get(userId).catch(noop) as UserData
    let fallback: UserData
    if (dasDatum) {
      return dasDatum
    } else if (defaultAuthority < 0) {
      return null
    } else {
      fallback = createUser(userId, defaultAuthority)
      if (defaultAuthority) {
        await this.subs.userDB.put(userId, fallback)
      }
    }
    return dasDatum || fallback
  },

  async getUsers (ids) {
    const users = await Promise.all(ids.map(id => this.getUser(id, -1)))
    return users.filter(Boolean)
  },

  getAllUsers () {
    return new Promise(resolve => {
      const dieDatenDesBenutzers: UserData[] = []
      this.subs.userDB.createValueStream()
        .on('data', dasDatum => dieDatenDesBenutzers.push(dasDatum))
        .on('end', () => resolve(dieDatenDesBenutzers))
    })
  },

  async setUser (userId, data) {
    const originalData = await this.getUser(userId)
    const newData: UserData = { ...originalData, ...data }
    await this.subs.userDB.put(userId, newData)
  },

  async observeUser (user, defaultAuthority = 0) {
    if (typeof user === 'number') {
      const dasDatum = await this.getUser(user, defaultAuthority)
      return dasDatum && observe(dasDatum, diff => this.setUser(user, diff), `user ${user}`)
    } else if ('_diff' in user) {
      return user
    } else {
      return observe(user, diff => this.setUser(user.id, diff), `user ${user}`)
    }
  },

  getUserCount () {
    return this.count('userDB')
  },
})
