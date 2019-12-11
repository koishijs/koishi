import { joinKeys, formatValues, arrayTypes } from './database'
import { observe, difference } from 'koishi-utils'
import { injectMethods, userFields, UserData, createUser, User } from 'koishi-core'

arrayTypes.push('users.endings', 'users.achievement', 'users.inference')

injectMethods('mysql', 'user', {
  async getUser (userId, defaultAuthority = 0, fields = userFields) {
    const [data] = await this.query('SELECT ' + joinKeys(fields) + ' FROM `users` WHERE `id` = ?', [userId]) as UserData[]
    let fallback: UserData
    if (data) {
      data.id = userId
    } else if (defaultAuthority < 0) {
      return null
    } else {
      fallback = createUser(userId, defaultAuthority)
      if (defaultAuthority) {
        await this.query(
          'INSERT INTO `users` (' + joinKeys(userFields) + ') VALUES (' + userFields.map(() => '?').join(', ') + ')',
          formatValues('users', fallback, userFields),
        )
      }
    }
    return data || fallback
  },

  async getUsers (ids, fields = userFields) {
    if (!ids.length) return []
    return this.query(`SELECT ${joinKeys(fields)} FROM users WHERE id IN (${ids.join(', ')})`)
  },

  async getAllUsers (fields = userFields) {
    return this.query('SELECT ' + joinKeys(fields) + ' FROM `users`')
  },

  async setUser (userId, data) {
    return this.update('users', userId, data)
  },

  async observeUser (user, defaultAuthority = 0, fields = userFields) {
    if (typeof user === 'number') {
      const data = await this.getUser(user, defaultAuthority, fields)
      return data && observe(data, diff => this.setUser(user, diff), `user ${user}`)
    } else {
      const additionalFields = difference(fields, Object.keys(user))
      const additionalData = additionalFields.length
        ? await this.getUser(user.id, defaultAuthority, difference(fields, Object.keys(user)))
        : {} as Partial<UserData>
      if ('_diff' in user) {
        return (user as User)._merge(additionalData)
      } else {
        return observe(Object.assign(user, additionalData), diff => this.setUser(user.id, diff), `user ${user.id}`)
      }
    }
  },

  async getUserCount () {
    return this.count('users')
  },
})
