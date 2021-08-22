import { Tables, TableType, Query, App, Database, User, Channel, Eval } from 'koishi-core'
import { clone, pick } from 'koishi-utils'

declare module 'koishi-core' {
  interface Database {
    memory: MemoryDatabase
    initUser(id: string, authority?: number): Promise<void>
    initChannel(id: string, assignee?: string): Promise<void>
  }

  namespace Database {
    interface Statics {
      'koishi-test-utils': typeof MemoryDatabase
    }
  }
}

export interface MemoryConfig {}

export interface MemoryDatabase extends Database {}

interface TableConfig<O> {
  primary?: keyof O
}

export class MemoryDatabase {
  $store: { [K in TableType]?: Tables[K][] } = {}

  memory = this

  static tables: { [K in TableType]?: TableConfig<Tables[K]> } = {}

  constructor(public app: App, public config: MemoryConfig) {}

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
  // comparison
  $eq: (query, data) => data.valueOf() === query.valueOf(),
  $ne: (query, data) => data.valueOf() !== query.valueOf(),
  $gt: (query, data) => data.valueOf() > query.valueOf(),
  $gte: (query, data) => data.valueOf() >= query.valueOf(),
  $lt: (query, data) => data.valueOf() < query.valueOf(),
  $lte: (query, data) => data.valueOf() <= query.valueOf(),

  // membership
  $in: (query, data) => query.includes(data),
  $nin: (query, data) => !query.includes(data),

  // regexp
  $regex: (query, data) => query.test(data),
  $regexFor: (query, data) => new RegExp(data, 'i').test(query),

  // bitwise
  $bitsAllSet: (query, data) => (query & data) === query,
  $bitsAllClear: (query, data) => (query & data) === 0,
  $bitsAnySet: (query, data) => (query & data) !== 0,
  $bitsAnyClear: (query, data) => (query & data) !== query,

  // list
  $el: (query, data) => data.some(item => executeFieldQuery(query, item)),
  $size: (query, data) => data.length === query,
}

type EvalOperators = {
  [K in keyof Eval.GeneralExpr]?: (args: Eval.GeneralExpr[K], data: any) => any
}

const evalOperators: EvalOperators = {
  // numeric
  $add: (args, data) => args.reduce<number>((prev, curr) => prev + executeEval(curr, data), 0),
  $multiply: (args, data) => args.reduce<number>((prev, curr) => prev * executeEval(curr, data), 0),
  $subtract: ([left, right], data) => executeEval(left, data) - executeEval(right, data),
  $divide: ([left, right], data) => executeEval(left, data) - executeEval(right, data),

  // boolean
  $eq: ([left, right], data) => executeEval(left, data).valueOf() === executeEval(right, data).valueOf(),
  $ne: ([left, right], data) => executeEval(left, data).valueOf() !== executeEval(right, data).valueOf(),
  $gt: ([left, right], data) => executeEval(left, data).valueOf() > executeEval(right, data).valueOf(),
  $gte: ([left, right], data) => executeEval(left, data).valueOf() >= executeEval(right, data).valueOf(),
  $lt: ([left, right], data) => executeEval(left, data).valueOf() < executeEval(right, data).valueOf(),
  $lte: ([left, right], data) => executeEval(left, data).valueOf() <= executeEval(right, data).valueOf(),

  // aggregation
  $sum: (expr, table: any[]) => table.reduce((prev, curr) => prev + executeEval(expr, curr), 0),
  $avg: (expr, table: any[]) => table.reduce((prev, curr) => prev + executeEval(expr, curr), 0) / table.length,
  $min: (expr, table: any[]) => Math.min(...table.map(data => executeEval(expr, data))),
  $max: (expr, table: any[]) => Math.max(...table.map(data => executeEval(expr, data))),
  $count: (expr, table: any[]) => new Set(table.map(data => executeEval(expr, data))).size,
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
    } else if (key === '$expr') {
      return executeEval(value, data)
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

function executeEval(expr: Eval.Any | Eval.Aggregation, data: any) {
  if (typeof expr === 'string') {
    return data[expr]
  } else if (typeof expr === 'number' || typeof expr === 'boolean') {
    return expr
  }

  for (const key in expr) {
    if (key in evalOperators) {
      return evalOperators[key](expr[key], data)
    }
  }
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

  async remove(name, query) {
    const entries = Object.entries(Query.resolve(name, query))
    this.$store[name] = this.$table(name)
      .filter(row => !entries.every(([key, value]) => value.includes(row[key])))
  },

  async create(table, data: any) {
    const store = this.$table(table)
    const { primary = 'id' } = MemoryDatabase.tables[table] || {}
    if (!data[primary]) {
      const max = store.length ? Math.max(...store.map(row => +row[primary])) : 0
      data[primary] = max + 1
    }
    store.push(data)
    return data
  },

  async update(table, data, key: string) {
    if (key) key = (MemoryDatabase.tables[table] || {}).primary || 'id'
    for (const item of data) {
      const row = this.$table(table).find(row => row[key] === item[key])
      Object.assign(row, clone(item))
    }
  },

  async aggregate(name, fields, query) {
    const expr = Query.resolve(name, query)
    const table = this.$table(name).filter(row => executeQuery(expr, row))
    return Object.fromEntries(Object.entries(fields).map(([key, expr]) => [key, executeEval(expr, table)]))
  },

  async getUser(type, id, fields) {
    if (Array.isArray(id)) {
      return this.get('user', { [type]: id }, fields) as any
    } else {
      return (await this.get('user', { [type]: [id] }, fields))[0]
    }
  },

  async setUser(type, id, data) {
    const table = this.$table('user')
    const index = table.findIndex(row => row[type] === id)
    if (index < 0) return
    Object.assign(table[index], clone(data))
  },

  async createUser(type, id, data) {
    const table = this.$table('user')
    const index = table.findIndex(row => row[type] === id)
    if (index >= 0) return
    const user = await this.create('user', {
      ...User.create(type, id),
      ...clone(data),
    })
    user.id = '' + user.id
  },

  initUser(id, authority = 1) {
    return this.createUser('mock', id, { authority })
  },

  async getChannel(type, id, fields) {
    if (Array.isArray(id)) {
      return this.get('channel', id.map(id => `${type}:${id}`), fields)
    } else {
      return (await this.get('channel', [`${type}:${id}`], fields))[0]
    }
  },

  async getAssignedChannels(fields, assignMap = this.app.getSelfIds()) {
    return this.$table('channel').filter((row) => {
      const [type] = row.id.split(':')
      return assignMap[type]?.includes(row.assignee)
    }).map(row => clone(pick(row, fields)))
  },

  async setChannel(type, id, data) {
    const table = this.$table('channel')
    const index = table.findIndex(row => row.id === `${type}:${id}`)
    if (index < 0) return
    Object.assign(table[index], clone(data))
  },

  async createChannel(type, id, data) {
    const table = this.$table('channel')
    const index = table.findIndex(row => row.id === `${type}:${id}`)
    if (index >= 0) return
    table.push({
      ...Channel.create(type, id),
      ...clone(data),
    })
  },

  initChannel(id, assignee = this.app.bots[0].selfId) {
    return this.createChannel('mock', id, { assignee })
  },
})

export function apply(app: App, config: MemoryConfig = {}) {
  app.database = new MemoryDatabase(app, config) as any
}
