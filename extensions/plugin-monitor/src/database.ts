import { arrayTypes } from 'koishi-plugin-mysql'
import { extendGroup, extendDatabase } from 'koishi-core'
import { OkPacket } from 'mysql'

declare module 'koishi-core/dist/database' {
  interface GroupData {
    subscribe: Record<number, number[]>
  }

  interface Tables {
    subscribe: Subscribe
  }

  interface Database {
    getSubscribes (ids?: number[], keys?: SubscribeField[]): Promise<Subscribe[]>
    findSubscribe (name: string[], keys?: SubscribeField[]): Promise<Subscribe[]>
    findSubscribe (name: string, keys?: SubscribeField[]): Promise<Subscribe>
    setSubscribe (id: number, data: Partial<Subscribe>): Promise<any>
    createSubscribe (options: SubscribeOptions): Promise<Subscribe>
    removeSubscribe (name: string): Promise<boolean>
  }
}

extendGroup(() => ({ subscribe: {} }))

arrayTypes.push('subscribe.names')

interface SubscribeOptions {
  names?: string[]
  bilibili?: string
  mirrativ?: string
  twitCasting?: string
}

export interface Subscribe extends SubscribeOptions {
  id: number
  bilibiliStatus: boolean
  mirrativStatus: boolean
  twitCastingStatus: boolean
}

export type SubscribeField = keyof Subscribe

const subscribeKeys = [
  'id', 'names',
  'bilibili', 'bilibiliStatus',
  'mirrativ', 'mirrativStatus',
  'twitCasting', 'twitCastingStatus',
] as SubscribeField[]

extendDatabase('koishi-plugin-mysql', {
  async getSubscribes (ids, keys = subscribeKeys) {
    if (!ids) return this.query(`SELECT * FROM \`subscribe\``)
    if (!ids.length) return []
    return this.query('SELECT ' + this.joinKeys(keys) + ` FROM \`subscribe\` WHERE \`id\` IN (${ids.map(id => `'${id}'`).join(',')})`)
  },

  async findSubscribe (names: string | string[], keys: SubscribeField[] = subscribeKeys) {
    const isSingle = typeof names === 'string'
    if (isSingle) names = [names as string]
    const data = await this.select('subscribe', keys, (names as string[]).map(name => `FIND_IN_SET(${this.escape(name)}, \`names\`)`).join(' OR '))
    return isSingle ? data[0] : data
  },

  async removeSubscribe (name) {
    const { changedRows } = await this.query<OkPacket>('DELETE FROM `subscribe` WHERE FIND_IN_SET(?, `names`)', [name])
    return !!changedRows
  },

  setSubscribe (id, data) {
    return this.update('subscribe', id, data)
  },

  createSubscribe (options) {
    return this.create('subscribe', options)
  },
})
