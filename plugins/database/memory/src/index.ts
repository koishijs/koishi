import { clone, Context, Database, Dict, DriverError, makeArray, Model, noop, pick, Tables } from 'koishi'
import { executeEval, executeQuery, executeSort, executeUpdate, Modifier, Query } from '@koishijs/orm'
import { Config, Storage } from './storage'

declare module 'koishi' {
  interface Database {
    memory: MemoryDatabase
  }
}

export class MemoryDatabase extends Database {
  public memory = this

  #store: Dict<any[]> = {}
  #loader: Storage

  constructor(public ctx: Context, public config: Config = {}) {
    super(ctx)

    if (config.storage) {
      this.#loader = new Storage(ctx, config)
    }
  }

  async start() {
    await this.#loader?.start(this.#store)
  }

  async $save(name: string) {
    await this.#loader?.save(name, this.#store[name])
  }

  stop() {}

  $table<K extends keyof Tables>(table: K) {
    return this.#store[table] ||= []
  }

  async drop() {
    this.#store = {}
    await this.#loader?.drop()
  }

  async stats() {
    return {}
  }

  $query(name: keyof Tables, query: Query) {
    const expr = this.resolveQuery(name, query)
    return this.$table(name).filter(row => executeQuery(row, expr))
  }

  async get(name: keyof Tables, query: Query, modifier?: Modifier) {
    const { fields, limit = Infinity, offset = 0, sort = {} } = this.resolveModifier(name, modifier)
    return executeSort(this.$query(name, query), sort)
      .slice(offset, offset + limit)
      .map(row => this.resolveData(name, row, fields))
  }

  async set(name: keyof Tables, query: Query, data: {}) {
    data = this.resolveUpdate(name, data)
    this.$query(name, query).forEach(row => executeUpdate(row, data))
    this.$save(name)
  }

  async remove(name: keyof Tables, query: Query) {
    const expr = this.resolveQuery(name, query)
    this.#store[name] = this.$table(name)
      .filter(row => !executeQuery(row, expr))
    this.$save(name)
  }

  async create<T extends keyof Tables>(name: T, data: any) {
    const store = this.$table(name)
    const { primary, fields, autoInc } = this.model.config[name]
    data = this.model.format(name, clone(data))
    if (!Array.isArray(primary) && autoInc && !(primary in data)) {
      const max = store.length ? Math.max(...store.map(row => +row[primary])) : 0
      data[primary] = max + 1
      if (Model.Field.string.includes(fields[primary].type)) {
        data[primary] += ''
      }
    } else {
      const duplicated = await this.get(name, pick(data, makeArray(primary)))
      if (duplicated.length) {
        throw new DriverError('duplicate-entry')
      }
    }
    const copy = this.model.create(name, data)
    store.push(copy)
    this.$save(name)
    return clone(copy)
  }

  async upsert(name: keyof Tables, data: any[], key: string | string[]) {
    const keys = makeArray(key || this.model.config[name].primary)
    for (const _item of data) {
      const item = this.model.format(name, _item)
      const row = this.$table(name).find(row => {
        return keys.every(key => row[key] === item[key])
      })
      if (row) {
        executeUpdate(row, item)
      } else {
        const data = this.model.create(name)
        await this.create(name, executeUpdate(data, item)).catch(noop)
      }
    }
    this.$save(name)
  }

  async eval(name: keyof Tables, expr: any, query: Query) {
    const table = this.$query(name, query)
    return executeEval(table, expr)
  }
}

export default MemoryDatabase
