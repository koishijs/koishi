import { Tables, TableType, App, extendDatabase } from 'koishi-core'
import { clone } from 'koishi-utils'

declare module 'koishi-core/dist/database' {
  interface Database extends MemoryDatabase {}
}

export interface MemoryConfig {}

export class MemoryDatabase {
  $store: { [K in TableType]?: Tables[K][] } = {
    user: [],
    channel: [],
  }

  constructor(public app: App, public config: MemoryConfig) {}

  $table<K extends TableType>(table: K): Tables[K][] {
    return this.$store[table] as any
  }

  $select<T extends TableType, K extends keyof Tables[T]>(table: T, key: K, values: readonly Tables[T][K][]) {
    return this.$table(table).filter(row => values.includes(row[key])).map(clone)
  }
}

extendDatabase(MemoryDatabase, {
  async getUser(type, id) {
    if (Array.isArray(id)) {
      return this.$select('user', type as any, id)
    } else {
      return this.$select('user', type as any, [id])[0]
    }
  },

  async setUser(type, id, data, autoCreate) {
    const table = this.$table('user')
    const index = table.findIndex(row => row[type] === id)
    if (index < 0) {
      if (autoCreate && data) {
        const max = Math.max(...table.map(row => row.id))
        table.push({
          id: max + 1,
          ...clone(data),
        } as any)
      }
      return
    }

    if (!data) {
      table.splice(index, 1)
      return
    }

    Object.assign(table[index], clone(data))
  },

  async getChannel(type, id) {
    if (Array.isArray(id)) {
      return this.$select('channel', 'id', id.map(id => `${type}:${id}`))
    } else {
      return this.$select('channel', 'id', [`${type}:${id}`])[0]
    }
  },

  async getChannelList(fields, type, assignees) {
    const assigneeMap: Record<string, readonly string[]> = Object.fromEntries(assignees ? [[type, assignees]]
      : type ? [[type, this.app.servers[type].bots.map(bot => bot.selfId)]]
        : Object.entries(this.app.servers).map(([type, { bots }]) => [type, bots.map(bot => bot.selfId)]))
    return this.$table('channel').filter((row) => {
      const [type] = row.id.split(':')
      return assigneeMap[type]?.includes(row.assignee)
    })
  },

  async setChannel(type, id, data) {
    const table = this.$table('channel')
    const index = table.findIndex(row => row.id === `${type}:${id}`)
    if (index < 0) {
      if (data) table.push(clone(data) as any)
      return
    }

    if (!data) {
      table.splice(index, 1)
      return
    }

    Object.assign(table[index], clone(data))
  },
})

export function apply(app: App, config: MemoryConfig = {}) {
  app.database = new MemoryDatabase(app, config) as any
}
