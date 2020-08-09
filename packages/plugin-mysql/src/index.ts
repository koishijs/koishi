import MysqlDatabase, { Config } from './database'
import { User, Group, Database, extendDatabase, Context } from 'koishi-core'

export * from './database'
export default MysqlDatabase

declare module 'koishi-core/dist/database' {
  interface Database extends MysqlDatabase {}
}

export const userGetters: Record<string, () => string> = {}

function inferFields (keys: readonly string[]) {
  return keys.map(key => key in userGetters ? `${userGetters[key]()} AS ${key}` : key) as User.Field[]
}

extendDatabase(MysqlDatabase, {
  async getUser (userId, ...args) {
    const authority = typeof args[0] === 'number' ? args.shift() as number : 0
    const fields = args[0] ? inferFields(args[0] as any) : User.fields
    if (fields && !fields.length) return {} as any
    const [data] = await this.select<User[]>('user', fields, '`id` = ?', [userId])
    let fallback: User
    if (data) {
      data.id = userId
    } else if (authority < 0) {
      return null
    } else {
      fallback = User.create(userId, authority)
      if (authority) {
        await this.query(
          'INSERT INTO `user` (' + this.joinKeys(User.fields) + ') VALUES (' + User.fields.map(() => '?').join(', ') + ')',
          this.formatValues('user', fallback, User.fields),
        )
      }
    }
    return data || fallback
  },

  async getUsers (...args) {
    let ids: readonly number[], fields: readonly User.Field[]
    if (args.length > 1) {
      ids = args[0]
      fields = inferFields(args[1])
    } else if (args.length && typeof args[0][0] !== 'string') {
      ids = args[0]
      fields = User.fields
    } else {
      fields = inferFields(args[0] as any)
    }
    if (ids && !ids.length) return []
    return this.select<User[]>('user', fields, ids && `\`id\` IN (${ids.join(', ')})`)
  },

  async setUser (userId, data) {
    await this.update('user', userId, data)
  },

  async getGroup (groupId, ...args) {
    const selfId = typeof args[0] === 'number' ? args.shift() as number : 0
    const fields = args[0] as any || Group.fields
    if (fields && !fields.length) return {} as any
    const [data] = await this.select<Group[]>('group', fields, '`id` = ?', [groupId])
    let fallback: Group
    if (!data) {
      fallback = Group.create(groupId, selfId)
      if (selfId && groupId) {
        await this.query(
          'INSERT INTO `group` (' + this.joinKeys(Group.fields) + ') VALUES (' + Group.fields.map(() => '?').join(', ') + ')',
          this.formatValues('group', fallback, Group.fields),
        )
      }
    } else {
      data.id = groupId
    }
    return data || fallback
  },

  async getAllGroups (...args) {
    let assignees: readonly number[], fields: readonly Group.Field[]
    if (args.length > 1) {
      fields = args[0]
      assignees = args[1]
    } else if (args.length && typeof args[0][0] === 'number') {
      fields = Group.fields
      assignees = args[0] as any
    } else {
      fields = args[0] || Group.fields
      assignees = await this.app.getSelfIds()
    }
    if (!assignees.length) return []
    return this.select<Group[]>('group', fields, `\`assignee\` IN (${assignees.join(',')})`)
  },

  async setGroup (groupId, data) {
    await this.update('group', groupId, data)
  },
})

export const name = 'mysql'

export function apply (ctx: Context, config: Config = {}) {
  const db = new MysqlDatabase(ctx.app, config)
  ctx.database = db as Database
  ctx.on('before-connect', () => db.start())
  ctx.on('before-disconnect', () => db.stop())
}
