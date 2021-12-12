import { Context, Database, Query, TableType, clone, makeArray, pick, Dict, valueMap, Model } from 'koishi'
import { executeEval, executeQuery } from '@koishijs/orm-utils'
import { Storage, Config } from './storage'

declare module 'koishi' {
  interface Database {
    memory: MemoryDatabase
  }

  interface Modules {
    'database-memory': typeof import('.')
  }
}

export class MemoryDatabase extends Database {
  public memory = this
  public $store: Dict<any[]> = {}

  private _storage: Storage

  constructor(public ctx: Context, public config: Config = {}) {
    super(ctx)

    if (config.storage) {
      this._storage = new Storage(ctx, config)
    }
  }

  async start() {
    await this._storage?.start(this.$store)
  }

  async $save(name: string) {
    await this._storage?.save(name, this.$store[name])
  }

  stop() {}

  $table<K extends TableType>(table: K) {
    return this.$store[table] ||= []
  }

  async drop(name: TableType) {
    if (name) {
      delete this.$store[name]
    } else {
      this.$store = {}
    }
    await this._storage?.drop(name)
  }

  async get(name: TableType, query: Query, modifier?: Query.Modifier) {
    const expr = this.ctx.model.resolveQuery(name, query)
    const { fields, limit = Infinity, offset = 0 } = Query.resolveModifier(modifier)
    return this.$table(name)
      .filter(row => executeQuery(expr, row))
      .map(row => clone(pick(row, fields)))
      .slice(offset, offset + limit)
  }

  async set(name: TableType, query: Query, data: {}) {
    const expr = this.ctx.model.resolveQuery(name, query)
    this.$table(name)
      .filter(row => executeQuery(expr, row))
      .forEach(row => Object.assign(row, data))
    this.$save(name)
  }

  async remove(name: TableType, query: Query) {
    const expr = this.ctx.model.resolveQuery(name, query)
    this.$store[name] = this.$table(name)
      .filter(row => !executeQuery(expr, row))
    this.$save(name)
  }

  async create(name: TableType, data: any) {
    const store = this.$table(name)
    const { primary, fields, autoInc } = this.ctx.model.config[name]
    data = clone(data)
    if (!Array.isArray(primary) && autoInc && !(primary in data)) {
      const max = store.length ? Math.max(...store.map(row => +row[primary])) : 0
      data[primary] = max + 1
      if (Model.Field.string.includes(fields[primary].type)) {
        data[primary] += ''
      }
    } else {
      const duplicated = await this.get(name, pick(data, makeArray(primary)))
      if (duplicated.length) return
    }
    const copy = { ...this.ctx.model.create(name), ...data }
    store.push(copy)
    this.$save(name)
    return copy
  }

  async upsert(name: TableType, data: any[], key: string | string[]) {
    const keys = makeArray(key || this.ctx.model.config[name].primary)
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
  }

  async aggregate(name: TableType, fields: {}, query: Query) {
    const expr = this.ctx.model.resolveQuery(name, query)
    const table = this.$table(name).filter(row => executeQuery(expr, row))
    return valueMap(fields, expr => executeEval(expr, table)) as any
  }
}

export default MemoryDatabase
