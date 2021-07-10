import {} from '@koishijs/plugin-mysql'
import {} from '@koishijs/plugin-mongo'
import { Channel, Database, Tables } from 'koishi-core'
import { OkPacket } from 'mysql'

declare module 'koishi-core' {
  interface Channel {
    subscribe: Record<number, string[]>
  }

  interface Tables {
    subscribe: Subscribe
  }

  interface Database {
    getSubscribes(ids?: number[], keys?: SubscribeField[]): Promise<Subscribe[]>
    findSubscribe(name: string[], keys?: SubscribeField[]): Promise<Subscribe[]>
    findSubscribe(name: string, keys?: SubscribeField[]): Promise<Subscribe>
    removeSubscribe(name: string): Promise<boolean>
  }
}

Channel.extend(() => ({ subscribe: {} }))

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

Tables.extend('subscribe')

Database.extend('@koishijs/plugin-mysql', {
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
})

Database.extend('@koishijs/plugin-mysql', ({ tables, Domain }) => {
  tables.channel.subscribe = new Domain.Json()
  tables.subscribe = {
    id: 'INT(10) UNSIGNED NOT NULL AUTO_INCREMENT',
    names: new Domain.Array(),
  }
})

Database.extend('@koishijs/plugin-mongo', {
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
})
