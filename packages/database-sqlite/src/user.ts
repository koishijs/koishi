import { injectMethods, userFields, UserData, createUser, User, UserField } from 'koishi-core'
import { observe } from 'koishi-utils'
import { arrayTypes, jsonTypes } from './database'

jsonTypes.push('user.usage')

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
    let ids: readonly number[], fields: readonly UserField[]
    if (args.length > 1) {
      ids = args[0]
      fields = args[1]
    } else if (args.length && typeof args[0][0] !== 'string') {
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
    const additionalData = fields.length
      ? await this.getUser(user.id, authority, fields)
      : {} as Partial<UserData>
    if ('_diff' in user) return (user as User)._merge(additionalData)
    return observe(Object.assign(user, additionalData), diff => this.setUser(user.id, diff), `user ${user.id}`)
  },
})
