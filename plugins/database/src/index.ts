import { App, Database, Query, Tables, TableType, clone, makeArray, pick, Context, Dict, valueMap, Schema } from 'koishi'
import { executeEval, executeQuery } from '@koishijs/orm-utils'
import { Storage, Config } from './storage'

declare module 'koishi' {
  interface Database {
    memory: MemoryDatabase
  }

  interface Modules {
    database: typeof import('.')
  }
}

export class MemoryDatabase extends Database {
  public memory = this
  public $store: Dict<any[]> = {}

  private _storage: Storage

  constructor(public app: App, public config: Config = {}) {
    super(app)

    if (config.storage) {
      this._storage = new Storage(config)
    }
  }

  async start() {
    await this._storage?.start(this.$store)
  }

  async $drop(name?: string) {
    await this._storage?.drop(name)
  }

  async $save(name: string) {
    await this._storage?.save(name, this.$store[name])
  }

  stop() {}

  $table<K extends TableType>(table: K) {
    return this.$store[table] ||= []
  }
}

Database.extend(MemoryDatabase, {
  async drop(name) {
    if (name) {
      delete this.$store[name]
    } else {
      this.$store = {}
    }
    await this.$drop(name)
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
    this.$save(name)
  },

  async remove(name, query) {
    const expr = Query.resolve(name, query)
    this.$store[name] = this.$table(name)
      .filter(row => !executeQuery(expr, row))
    this.$save(name)
  },

  async create(name, data: any) {
    const store = this.$table(name)
    const { primary, fields, autoInc } = Tables.config[name] as Tables.Config
    data = clone(data)
    if (!Array.isArray(primary) && autoInc && !(primary in data)) {
      const max = store.length ? Math.max(...store.map(row => +row[primary])) : 0
      data[primary] = max + 1
      if (Tables.Field.string.includes(fields[primary].type)) {
        data[primary] += ''
      }
    } else {
      const duplicated = await this.get(name, pick(data, makeArray(primary)))
      if (duplicated.length) return
    }
    const copy = { ...Tables.create(name), ...data }
    store.push(copy)
    this.$save(name)
    return copy
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
    this.$save(name)
  },

  async aggregate(name, fields, query) {
    const expr = Query.resolve(name, query)
    const table = this.$table(name).filter(row => executeQuery(expr, row))
    return valueMap(fields, expr => executeEval(expr, table))
  },
})

export const name = 'database'

export const schema: Schema<Config> = Schema.object({})

export function apply(ctx: Context, config: Config = {}) {
  ctx.database = new MemoryDatabase(ctx.app, config)
}
