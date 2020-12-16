import MongoDatabase, { Config } from './database'
import { User, Channel, Database, extendDatabase, Context } from 'koishi-core'

export * from './database'
export default MongoDatabase

declare module 'koishi-core/dist/database' {
  interface Database extends MongoDatabase { }
}

function escapeKey<T extends Partial<User>>(doc: T) {
  const data: T = { ...doc }
  delete data.timers
  delete data.usage
  if (doc.timers) {
    data.timers = {}
    for (const key in doc.timers) {
      if (key === '$date') data.timers._date = doc.timers.$date
      else data.timers[key.replace(/\./gmi, '_')] = doc.timers[key]
    }
  }
  if (doc.usage) {
    data.usage = {}
    for (const key in doc.usage) {
      if (key === '$date') data.usage._date = doc.usage.$date
      else data.usage[key.replace(/\./gmi, '_')] = doc.usage[key]
    }
  }
  return data
}

function unescapeKey<T extends Partial<User>>(data: T) {
  if (data.timers) {
    if (data.timers._date) {
      data.timers.$date = data.timers._date
      delete data.timers._date
    }
    for (const key in data.timers) {
      if (key.includes('_')) {
        data.timers[key.replace(/_/gmi, '.')] = data.timers[key]
        delete data.timers[key]
      }
    }
  }
  if (data.usage) {
    if (data.usage._date) {
      data.usage.$date = data.usage._date
      delete data.usage._date
    }
    for (const key in data.usage) {
      if (key.includes('_')) {
        data.usage[key.replace(/_/gmi, '.')] = data.usage[key]
        delete data.usage[key]
      }
    }
  }
  return data
}

extendDatabase(MongoDatabase, {
  async getUser(userId, ...args) {
    const authority = typeof args[0] === 'number' ? args.shift() as number : 0
    const fields = args[0] ? args[0] as any : User.fields
    if (fields && !fields.length) return {} as any
    const data: Partial<User> = (await this.user.findOne({ _id: userId })) || {}
    if (authority < 0) return null
    const fallback = User.create(userId, authority)
    if (authority && [undefined, null].includes(data.authority)) await this.user.updateOne({ _id: userId }, { $set: { authority } }, { upsert: true })
    return { ...fallback, ...unescapeKey(data) }
  },

  async getUsers(...args) {
    let ids: readonly number[]
    let fields: readonly User.Field[]
    if (args.length > 1) {
      ids = args[0]
      fields = args[1]
    } else if (args.length && typeof args[0][0] !== 'string') {
      ids = args[0]
      fields = User.fields
    } else fields = args[0] as any
    if (ids && !ids.length) return []
    const f = {}
    for (const field of fields) f[field] = 1
    return this.user.find({ _id: { $in: ids as number[] } }).project(f).map(unescapeKey).toArray()
  },

  async setUser(userId, data) {
    await this.user.updateOne({ _id: userId }, { $set: escapeKey(data) }, { upsert: true })
  },

  async getGroup(groupId, ...args) {
    const selfId = typeof args[0] === 'number' ? args.shift() as number : 0
    const fields = args[0] as any || Channel.fields
    if (fields && !fields.length) return {} as any
    const f = {}
    for (const field of fields) f[field] = 1
    const [data] = await this.group.find({ _id: groupId }).project(f).toArray()
    const fallback = Channel.create(groupId, selfId)
    if (!data?.assignee && selfId && groupId) {
      await this.group.updateOne({ _id: groupId }, { $set: { assignee: selfId, flag: 0 } }, { upsert: true })
    }
    return { ...fallback, ...data }
  },

  async getAllGroups(...args) {
    let assignees: number[]
    let fields: readonly Channel.Field[]
    if (args.length > 1) {
      fields = args[0]
      assignees = args[1] as number[]
    } else if (args.length && typeof args[0][0] === 'number') {
      fields = Channel.fields
      assignees = args[0] as any
    } else {
      fields = args[0] || Channel.fields
      assignees = await this.app.getSelfIds()
    }
    if (!assignees.length) return []
    const f = {}
    for (const field of fields) f[field] = 1
    const fallback = Channel.create(0, 0)
    const results = await this.group.find({ assignee: { $in: assignees } }).project(f).toArray()
    return results.map(result => ({
      ...fallback, ...result, id: result._id,
    }))
  },

  async setGroup(groupId, data) {
    await this.group.updateOne({ _id: groupId }, { $set: data })
  },
})

export const name = 'mongo'

export function apply(ctx: Context, config: Config) {
  const db = new MongoDatabase(ctx.app, { host: 'localhost', port: 27017, name: 'koishi', protocol: 'mongodb', ...config })
  ctx.database = db as Database
  ctx.on('before-connect', () => db.start())
  ctx.on('before-disconnect', () => db.stop())
}
