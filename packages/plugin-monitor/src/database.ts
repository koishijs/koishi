import MysqlDatabase from 'koishi-plugin-mysql/dist/database'
import MongoDatabase from 'koishi-plugin-mongo/dist/database'
import { Group, extendDatabase } from 'koishi-core'
import { OkPacket } from 'mysql'

declare module 'koishi-core/dist/database' {
  interface Group {
    subscribe: Record<number, number[]>
  }

  interface Tables {
    subscribe: Subscribe
  }

  interface Database {
    getSubscribes(ids?: number[], keys?: SubscribeField[]): Promise<Subscribe[]>
    findSubscribe(name: string[], keys?: SubscribeField[]): Promise<Subscribe[]>
    findSubscribe(name: string, keys?: SubscribeField[]): Promise<Subscribe>
    setSubscribe(id: number, data: Partial<Subscribe>): Promise<any>
    createSubscribe(options: SubscribeOptions): Promise<Subscribe>
    removeSubscribe(name: string): Promise<boolean>
  }
}

Group.extend(() => ({ subscribe: {} }))

interface SubscribeOptions {
  names?: string[]
  bilibili?: string
  mirrativ?: string
  twitcasting?: string
}

export interface Subscribe extends SubscribeOptions {
  id: number
  bilibiliStatus: boolean
  mirrativStatus: boolean
  twitcastingStatus: boolean
}

export type SubscribeField = keyof Subscribe

const subscribeKeys = [
  'id', 'names',
  'bilibili', 'bilibiliStatus',
  'mirrativ', 'mirrativStatus',
  'twitCasting', 'twitCastingStatus',
] as SubscribeField[]

extendDatabase<typeof MysqlDatabase>('koishi-plugin-mysql', {
  async getSubscribes(ids, keys = subscribeKeys) {
    if (!ids) return this.query('SELECT * FROM `subscribe`')
    if (!ids.length) return []
    return this.query('SELECT ' + this.joinKeys(keys) + ` FROM \`subscribe\` WHERE \`id\` IN (${ids.map(id => `'${id}'`).join(',')})`)
  },

  async findSubscribe(names: string | string[], keys: SubscribeField[] = subscribeKeys) {
    const isSingle = typeof names === 'string'
    if (isSingle) names = [names as string]
    const data = await this.select('subscribe', keys, (names as string[]).map(name => `FIND_IN_SET(${this.escape(name)}, \`names\`)`).join(' OR '))
    return isSingle ? data[0] : data as any
  },

  async removeSubscribe(name) {
    const { changedRows } = await this.query<OkPacket>('DELETE FROM `subscribe` WHERE FIND_IN_SET(?, `names`)', [name])
    return !!changedRows
  },

  setSubscribe(id, data) {
    return this.update('subscribe', id, data)
  },

  createSubscribe(options) {
    return this.create('subscribe', options)
  },
})

extendDatabase<typeof MysqlDatabase>('koishi-plugin-mysql', ({ listFields, tables }) => {
  listFields.push('subscribe.names')
  tables.group.subscribe = `JSON NULL DEFAULT NULL`
})

extendDatabase<typeof MongoDatabase>('koishi-plugin-mongo', {
  async getSubscribes(ids, keys = subscribeKeys) {
    if (!ids) return this.db.collection('subscribe').find().toArray()
    if (!ids.length) return []
    const p = {}
    for (const key of keys) p[key] = 1
    return this.db.collection('subscribe').find({ _id: { $in: ids } }).project(p).toArray()
  },

  async findSubscribe(names: string | string[], keys: SubscribeField[] = subscribeKeys) {
    const isSingle = typeof names === 'string'
    if (isSingle) names = [names as string]
    const p = {}
    for (const key of keys) p[key] = 1
    const data = await this.db.collection('subscribe').find({ names: { $elemMatch: { $in: names } } }).project(p).toArray()
    return isSingle ? data[0] : data as any
  },

  async removeSubscribe(name) {
    const result = await this.db.collection('subscribe').deleteMany({ names: { $elemMatch: { $eq: name } } })
    return !!result.deletedCount
  },

  setSubscribe(_id, data) {
    return this.db.collection('subscribe').updateOne({ _id }, { $set: data })
  },

  async createSubscribe(options) {
    let _id = 1
    const [latest] = await this.db.collection('subscribe').find().sort('_id', -1).limit(1).toArray()
    if (latest) _id = latest._id + 1
    const res = await this.db.collection('subscribe').insertOne({ _id, id: _id, ...options })
    return { id: res.insertedId, ...options, bilibiliStatus: false, mirrativStatus: false, twitcastingStatus: false }
  },
})
