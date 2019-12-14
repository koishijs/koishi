import { injectMethods, userFields, UserData, createUser, User, UserField } from 'koishi-core'
import { observe, difference } from 'koishi-utils'
import { arrayTypes, jsonTypes } from './database'

arrayTypes.push('user.endings', 'user.achievement', 'user.inference')
jsonTypes.push('user.talkativeness', 'user.usage')

injectMethods('sqlite', 'user', {
  async getUser (userId, ...args) {
    const authority = typeof args[0] === 'number' ? args.shift() as number : 0
    const fields = args[0] as never || userFields
    const [data] = await this.select<UserData>('user', fields, '`id` = ' + userId)
    let fallback: UserData
    if (data) {
      data.id = userId
    } else if (authority < 0) {
      return null
    } else {
      fallback = createUser(userId, authority)
      if (authority) {
        await this.get(
          'INSERT INTO `user` (' + this.joinKeys(userFields) + ') VALUES (' + userFields.map(() => '?').join(', ') + ')',
          this.formatValues('user', fallback, userFields),
        )
      }
    }
    return data || fallback
  },

  async getUsers (...args) {
    let ids: number[], fields: UserField[]
    if (args.length > 1) {
      ids = args[0]
      fields = args[1]
    } else if (args.length && typeof args[0][0] === 'number') {
      ids = args[0]
      fields = userFields
    } else {
      fields = args[0] as any
    }
    if (ids && !ids.length) return []
    return this.select('user', fields, ids && `\`id\` IN (${ids.join(', ')})`)
  },

  async setUser (userId, data) {
    return this.update('user', userId, data)
  },

  async observeUser (user, ...args) {
    if (typeof user === 'number') {
      const data = await this.getUser(user, ...args)
      return data && observe(data, diff => this.setUser(user, diff), `user ${user}`)
    }

    const authority = typeof args[0] === 'number' ? args.shift() as number : 0
    const fields = args[0] as never || userFields
    const additionalFields = difference(fields, Object.keys(user))
    const additionalData = additionalFields.length
      ? await this.getUser(user.id, authority, difference(fields, Object.keys(user)))
      : {} as Partial<UserData>
    if ('_diff' in user) {
      return (user as User)._merge(additionalData)
    } else {
      return observe(Object.assign(user, additionalData), diff => this.setUser(user.id, diff), `user ${user.id}`)
    }
  },

  async getUserCount () {
    return this.count('user')
  },
})
