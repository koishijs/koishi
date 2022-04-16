import { clone, Context, Database, Dict, DriverError, makeArray, Model, noop, pick, Tables } from 'koishi'
import { Executable, executeEval, executeUpdate, Query } from '@koishijs/orm'
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

  $table(table: string) {
    return this.#store[table] ||= []
  }

  async drop() {
    this.#store = {}
    await this.#loader?.drop()
  }

  async stats() {
    return {}
  }

  async execute(selection: Executable) {
    const { table, fields, expr } = selection
    const data = this.$table(table).filter(row => selection.filter(row))
    if (expr) return executeEval(data, expr)
    return selection
      .truncate(data)
      .map(row => this.resolveData<any>(table, row, fields))
  }

  async set(name: keyof Tables, query: Query, data: {}) {
    data = this.resolveUpdate(name, data)
    const selection = this.select(name, query)
    this.$table(name)
      .filter(row => selection.filter(row))
      .forEach(row => executeUpdate(row, data))
    this.$save(name)
  }

  async remove(name: keyof Tables, query: Query) {
    const selection = this.select(name, query)
    this.#store[name] = this.$table(name).filter(row => !selection.filter(row))
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
}

export default MemoryDatabase
