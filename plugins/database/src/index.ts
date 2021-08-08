import { App, Database, Query, Tables, TableType, clone, makeArray, pick, Field, Context } from 'koishi'

declare module 'koishi' {
  interface Database {
    memory: MemoryDatabase
    initUser(id: string, authority?: number): Promise<void>
    initChannel(id: string, assignee?: string): Promise<void>
  }

  namespace Database {
    interface Statics {
      '@koishijs/plugin-database': typeof MemoryDatabase
    }
  }
}

export interface MemoryConfig {}

export class MemoryDatabase extends Database {
  memory = this

  constructor(public app: App, public config: MemoryConfig) {
    super(app)
  }

  start() {}

  stop() {}

  $store: { [K in TableType]?: Tables[K][] } = {}

  $table<K extends TableType>(table: K): any[] {
    return this.$store[table] ||= []
  }

  $count<K extends TableType>(table: K, field: keyof Tables[K] = 'id') {
    return new Set(this.$table(table).map(data => data[field])).size
  }
}

const queryOperators: ([string, (data: any, value: any) => boolean])[] = Object.entries({
  $regex: (data: RegExp, value) => data.test(value),
  $regexFor: (data, value) => new RegExp(value, 'i').test(data),
  $in: (data: any[], value) => data.includes(value),
  $nin: (data: any[], value) => !data.includes(value),
  $ne: (data, value) => value !== data,
  $eq: (data, value) => value === data,
  $gt: (data, value) => value > data,
  $gte: (data, value) => value >= data,
  $lt: (data, value) => value < data,
  $lte: (data, value) => value <= data,
})

function executeQuery(query: Query.Expr, data: any): boolean {
  const entries: [string, any][] = Object.entries(query)
  return entries.every(([key, value]) => {
    if (key === '$and') {
      return (value as Query.Expr[]).reduce((prev, query) => prev && executeQuery(query, data), true)
    } else if (key === '$or') {
      return (value as Query.Expr[]).reduce((prev, query) => prev || executeQuery(query, data), false)
    } else if (key === '$not') {
      return !executeQuery(value, data)
    } else if (Array.isArray(value)) {
      return value.includes(data[key])
    } else if (value instanceof RegExp) {
      return value.test(data[key])
    } else if (typeof value === 'string' || typeof value === 'number') {
      return value === data[key]
    }
    return queryOperators.reduce((prev, [prop, callback]) => {
      return prev && (prop in value ? callback(value[prop], data[key]) : true)
    }, true)
  })
}

Database.extend(MemoryDatabase, {
  async get(name, query, modifier) {
    const expr = Query.resolve(name, query)
    const { fields, limit = Infinity, offset = 0 } = Query.resolveModifier(modifier)
    return this.$table(name)
      .filter(row => executeQuery(expr, row))
      .map(row => clone(pick(row, fields)))
      .slice(offset, offset + limit)
  },

  async remove(name, query) {
    const entries = Object.entries(Query.resolve(name, query))
    this.$store[name] = this.$table(name)
      .filter(row => !entries.every(([key, value]) => value.includes(row[key])))
  },

  async create(name, data: any) {
    const store = this.$table(name)
    const { primary, fields } = Tables.config[name] as Tables.Meta
    data = clone(data)
    if (!data[primary]) {
      const max = store.length ? Math.max(...store.map(row => +row[primary])) : 0
      data[primary] = max + 1
      if (Field.stringTypes.includes(fields[primary].type)) {
        data[primary] += ''
      }
    }
    store.push(data)
    return data
  },

  async update(name, data, key) {
    const keys = makeArray(key || Tables.config[name].primary)
    for (const item of data) {
      const row = this.$table(name).find(row => {
        return keys.every(key => row[key] === item[key])
      })
      if (row) {
        Object.assign(row, clone(item))
      } else {
        await this.create(name, item)
      }
    }
  },

  initUser(id, authority = 1) {
    return this.setUser('mock', id, { authority })
  },

  async getAssignedChannels(fields, assignMap = this.app.getSelfIds()) {
    return this.$table('channel').filter((row) => {
      const [type] = row.id.split(':')
      return assignMap[type]?.includes(row.assignee)
    }).map(row => clone(pick(row, fields)))
  },

  initChannel(id, assignee = this.app.bots[0].selfId) {
    return this.setChannel('mock', id, { assignee })
  },
})

export const name = 'database'

export function apply(ctx: Context, config: MemoryConfig = {}) {
  ctx.database = new MemoryDatabase(ctx.app, config)
}
