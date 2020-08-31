import MongoDatabase, { Config } from './database'
import { User, Group, Database, extendDatabase, Context } from 'koishi-core'

export * from './database'
export default MongoDatabase

declare module 'koishi-core/dist/database' {
  interface Database extends MongoDatabase { }
}

extendDatabase(MongoDatabase, {
  async getUser(userId, ...args) {
    const authority = typeof args[0] === 'number' ? args.shift() as number : 0
    const fields = args[0] ? args[0] as any : User.fields
    if (fields && !fields.length) return {} as any
    const data = await this.user.findOne({ _id: userId })
    let fallback: User
    if (authority < 0) return null
    if (!data) {
      fallback = User.create(userId, authority)
      if (authority) {
        this.user.updateOne(
          { _id: userId },
          {
            $set: { authority },
            $setOnInsert: {
              id: userId,
              flag: 0,
              name: `${userId}`,
              usage: {},
              timers: {},
            },
          },
          { upsert: true },
        )
      }
    } else {
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
    }
    return data || fallback
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
    return this.user.find({ _id: { $in: ids as number[] } }).project(f).map((doc) => {
      if (doc.timers) {
        if (doc.timers._date) {
          doc.timers.$date = doc.timers._date
          delete doc.timers._date
        }
        for (const key in doc.timers) {
          if (key.includes('_')) {
            doc.timers[key.replace(/_/gmi, '.')] = doc.timers[key]
            delete doc.timers[key]
          }
        }
      }
      if (doc.usage) {
        if (doc.usage._date) {
          doc.usage.$date = doc.usage._date
          delete doc.usage._date
        }
        for (const key in doc.usage) {
          if (key.includes('_')) {
            doc.usage[key.replace(/_/gmi, '.')] = doc.usage[key]
            delete doc.usage[key]
          }
        }
      }
      return doc
    }).toArray()
  },

  async setUser(userId, data) {
    const $set: any = { ...data }
    delete $set.timers
    delete $set.usage
    if (data.timers) {
      $set.timers = {}
      for (const key in data.timers) {
        if (key === '$date') $set.timers._date = data.timers.$date
        else $set.timers[key.replace(/\./gmi, '_')] = data.timers[key]
      }
    }
    if (data.usage) {
      $set.usage = {}
      for (const key in data.usage) {
        if (key === '$date') $set.usage._date = data.usage.$date
        else $set.usage[key.replace(/\./gmi, '_')] = data.usage[key]
      }
    }
    await this.user.updateOne({ _id: userId }, { $set }, { upsert: true })
  },

  async getGroup(groupId, ...args) {
    const selfId = typeof args[0] === 'number' ? args.shift() as number : 0
    const fields = args[0] as any || Group.fields
    if (fields && !fields.length) return {} as any
    const f = {}
    for (const field of fields) f[field] = 1
    const [data] = await this.group.find({ _id: groupId }).project(f).toArray()
    let fallback: Group
    if (!data) {
      fallback = Group.create(groupId, selfId)
      if (selfId && groupId) {
        this.group.updateOne(
          { _id: groupId },
          {
            $set: { assignee: selfId },
            $setOnInsert: {
              id: groupId,
              flag: 0,
            },
          },
          { upsert: true },
        )
      }
    }
    return data || fallback
  },

  async getAllGroups(...args) {
    let assignees: number[]
    let fields: readonly Group.Field[]
    if (args.length > 1) {
      fields = args[0]
      assignees = args[1] as number[]
    } else if (args.length && typeof args[0][0] === 'number') {
      fields = Group.fields
      assignees = args[0] as any
    } else {
      fields = args[0] || Group.fields
      assignees = await this.app.getSelfIds()
    }
    if (!assignees.length) return []
    const f = {}
    for (const field of fields) f[field] = 1
    return this.group.find({ assignee: { $in: assignees } }).project(f).toArray()
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
