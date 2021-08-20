import { App, Database, Query, Tables, TableType, clone, makeArray, pick, Context } from 'koishi'

declare module 'koishi' {
  interface Database {
    memory: MemoryDatabase
    initUser(id: string, authority?: number): Promise<void>
    initChannel(id: string, assignee?: string): Promise<void>
  }

  namespace Database {
    interface Library {
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

type QueryOperators = {
  [K in keyof Query.FieldExpr]?: (query: Query.FieldExpr[K], data: any) => boolean
}

const queryOperators: QueryOperators = {
  $regex: (query, data) => query.test(data),
  $regexFor: (query, data) => new RegExp(data, 'i').test(query),
  $in: (query, data) => query.includes(data),
  $nin: (query, data) => !query.includes(data),
  $ne: (query, data) => data.valueOf() !== query.valueOf(),
  $eq: (query, data) => data.valueOf() === query.valueOf(),
  $gt: (query, data) => data.valueOf() > query.valueOf(),
  $gte: (query, data) => data.valueOf() >= query.valueOf(),
  $lt: (query, data) => data.valueOf() < query.valueOf(),
  $lte: (query, data) => data.valueOf() <= query.valueOf(),
  $el: (query, data) => data.some(item => executeFieldQuery(query, item)),
  $size: (query, data) => data.length === query,
  $bitsAllSet: (query, data) => (query & data) === query,
  $bitsAllClear: (query, data) => (query & data) === 0,
  $bitsAnySet: (query, data) => (query & data) !== 0,
  $bitsAnyClear: (query, data) => (query & data) !== query,
}

function executeFieldQuery(query: Query.FieldQuery, data: any) {
  // shorthand syntax
  if (Array.isArray(query)) {
    return query.includes(data)
  } else if (query instanceof RegExp) {
    return query.test(data)
  } else if (typeof query === 'string' || typeof query === 'number' || query instanceof Date) {
    return data.valueOf() === query.valueOf()
  }

  // query operators
  for (const key in queryOperators) {
    const value = query[key]
    if (value === undefined) continue
    if (!queryOperators[key](value, data)) return false
  }

  return true
}

function executeQuery(query: Query.Expr, data: any): boolean {
  const entries: [string, any][] = Object.entries(query)
  return entries.every(([key, value]) => {
    // execute logical query
    if (key === '$and') {
      return (value as Query.Expr[]).reduce((prev, query) => prev && executeQuery(query, data), true)
    } else if (key === '$or') {
      return (value as Query.Expr[]).reduce((prev, query) => prev || executeQuery(query, data), false)
    } else if (key === '$not') {
      return !executeQuery(value, data)
    }

    // execute field query
    try {
      if (!(key in data)) return false
      return executeFieldQuery(value, data[key])
    } catch {
      return false
    }
  })
}

Database.extend(MemoryDatabase, {
  async drop(name) {
    if (name) {
      delete this.$store[name]
    } else {
      this.$store = {}
    }
  },

  async get(name, query, modifier) {
    const expr = Query.resolve(name, query)
    const { fields, limit = Infinity, offset = 0 } = Query.resolveModifier(modifier)
    return this.$table(name)
      .filter(row => executeQuery(expr, row))
      .map(row => clone(pick(row, fields)))
      .slice(offset, offset + limit)
  },

  async set(name, query, data) {
    const expr = Query.resolve(name, query)
    this.$table(name)
      .filter(row => executeQuery(expr, row))
      .forEach(row => Object.assign(row, data))
  },

  async remove(name, query) {
    const entries = Object.entries(Query.resolve(name, query))
    this.$store[name] = this.$table(name)
      .filter(row => !entries.every(([key, value]) => value.includes(row[key])))
  },

  async create(name, data: any) {
    const store = this.$table(name)
    const { primary, fields } = Tables.config[name] as Tables.Config
    data = clone(data)
    if (!Array.isArray(primary) && !data[primary]) {
      const max = store.length ? Math.max(...store.map(row => +row[primary])) : 0
      data[primary] = max + 1
      if (Tables.Field.string.includes(fields[primary].type)) {
        data[primary] += ''
      }
    }
    store.push(data)
    return data
  },

  async upsert(name, data, key) {
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

  initChannel(id, assignee = this.app.bots[0].selfId) {
    return this.setChannel('mock', id, { assignee })
  },
})

export const name = 'database'

export function apply(ctx: Context, config: MemoryConfig = {}) {
  ctx.database = new MemoryDatabase(ctx.app, config)
}
