import { MongoClient, Db, Collection } from 'mongodb'
import { App, UserField, UserData, userFields, createUser, GroupData, groupFields, createGroup, GroupField, Database, extendDatabase, Context } from 'koishi-core'

declare module 'koishi-core/dist/database' {
  interface Database extends MongoDatabase { }
}

export interface Options {
  username?: string,
  password?: string,
  host: string,
  port: number,
  name: string,
}

interface Udoc extends UserData {
  _id: number,
}
interface Gdoc extends GroupData {
  _id: number,
}

export default class MongoDatabase {
  public client: MongoClient;
  public db: Db;
  user: Collection<Udoc>;
  group: Collection<Gdoc>;

  constructor (public app: App, public config: Options) {
    this.config = config
  }

  async start () {
    let mongourl = 'mongodb://'
    if (this.config.username) mongourl += `${this.config.username}:${this.config.password}@`
    mongourl += `${this.config.host}:${this.config.port}/${this.config.name}`
    this.client = await MongoClient.connect(mongourl, { useNewUrlParser: true, useUnifiedTopology: true })
    this.db = this.client.db(this.config.name)
    this.user = this.db.collection('user')
    this.group = this.db.collection('group')
  }

  stop () {
    return this.client.close()
  }
}

extendDatabase(MongoDatabase, {
  async getUser (userId, ...args) {
    const authority = typeof args[0] === 'number' ? args.shift() as number : 0
    const fields = args[0] ? args[0] as any : userFields
    if (fields && !fields.length) return {} as any
    const data = await this.user.findOne({ _id: userId })
    let fallback: UserData
    if (authority < 0) return null
    else if (!data) {
      fallback = createUser(userId, authority)
      if (authority) {
        this.user.updateOne(
          { _id: userId },
          {
            $set: { authority },
            $setOnInsert: {
              id: userId,
              flag: 0,
              name: '' + userId,
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
    let ids: readonly number[], fields: readonly UserField[]
    if (args.length > 1) {
      ids = args[0]
      fields = args[1]
    } else if (args.length && typeof args[0][0] !== 'string') {
      ids = args[0]
      fields = userFields
    } else fields = args[0] as any
    if (ids && !ids.length) return []
    return this.user.find({ _id: { $in: ids as number[] } }).toArray()
  },

  async setUser (userId, data) {
    await this.user.updateOne({ _id: userId }, { $set: data }, { upsert: true })
  },

  async getGroup (groupId, ...args) {
    const selfId = typeof args[0] === 'number' ? args.shift() as number : 0
    const fields = args[0] as any || groupFields
    if (fields && !fields.length) return {} as any
    const data = await this.group.findOne({ _id: groupId })
    let fallback: GroupData
    if (!data) {
      fallback = createGroup(groupId, selfId)
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
    let assignees: readonly number[], fields: readonly GroupField[]
    if (args.length > 1) {
      fields = args[0]
      assignees = args[1]
    } else if (args.length && typeof args[0][0] === 'number') {
      fields = groupFields
      assignees = args[0] as any
    } else {
      fields = args[0] || groupFields
      assignees = await this.app.getSelfIds()
    }
    if (!assignees.length) return []
    return this.group.find({ assignee: { $in: assignees as number[] } }).toArray()
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
