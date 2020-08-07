import { MongoClient, Db, Collection } from 'mongodb'
import {
  App, User, Group, Database, extendDatabase, Context,
} from 'koishi-core'

declare module 'koishi-core/dist/database' {
  interface Database extends MongoDatabase { }
}

export interface Options {
  username?: string,
  password?: string,
  host?: string,
  port?: number,
  name?: string,
  prefix?: string,
}

interface Udoc extends User {
  _id: number,
}
interface Gdoc extends Group {
  _id: number,
}

export default class MongoDatabase {
  public client: MongoClient;

  public db: Db;

  user: Collection<Udoc>;

  group: Collection<Gdoc>;

  watcher: any;

  constructor (public app: App, public config: Options) {
    this.config = config
  }

  async start () {
    let mongourl = 'mongodb://'
    if (this.config.username) mongourl += `${this.config.username}:${this.config.password}@`
    mongourl += `${this.config.host}:${this.config.port}/${this.config.name}`
    this.client = await MongoClient.connect(
      mongourl, { useNewUrlParser: true, useUnifiedTopology: true },
    )
    this.db = this.client.db(this.config.name)
    this.user = this.db.collection(this.config.prefix ? `${this.config.prefix}.user` : 'user')
    this.group = this.db.collection(this.config.prefix ? `${this.config.prefix}.group` : 'group')
  }

  stop () {
    return this.client.close()
  }
}

extendDatabase(MongoDatabase, {
  async getUser (userId, ...args) {
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
    }
    return data || fallback
  },

  async getUsers (...args) {
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
      if (doc.timers._date) {
        doc.timers.$date = doc.timers._date
        delete doc.timers._date
      }
      if (doc.usage._date) {
        doc.usage.$date = doc.usage._date
        delete doc.usage._date
      }
      return doc
    }).toArray()
  },

  async setUser (userId, data) {
    const converted = { ...data }
    if (converted.timers) {
      if (converted.timers.$date) {
        converted.timers._date = converted.timers.$date
        delete converted.timers.$date
      }
    }
    if (converted.usage) {
      if (converted.usage.$date) {
        converted.usage._date = converted.usage.$date
        delete converted.usage.$date
      }
    }
    await this.user.updateOne({ _id: userId }, { $set: data }, { upsert: true })
  },

  async getGroup (groupId, ...args) {
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

  async getAllGroups (...args) {
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

  async setGroup (groupId, data) {
    await this.group.updateOne({ _id: groupId }, { $set: data })
  },
})

export const name = 'mongo'

export function apply (ctx: Context, config: Options = { host: 'localhost', port: 27017, name: 'koishi' }) {
  const db = new MongoDatabase(ctx.app, config)
  ctx.database = db as Database
  ctx.on('before-connect', () => db.start())
  ctx.on('before-disconnect', () => db.stop())
}
