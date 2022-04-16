import { clone, Context, Database, Dict, DriverError, makeArray, noop, pick, Tables } from 'koishi'
import { Executable, executeEval, Field, Query } from '@koishijs/orm'
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

  async execute(sel: Executable) {
    const { table, fields, expr } = sel
    const data = this.$table(table).filter(row => sel.filter(row))
    if (expr) {
      return executeEval(data.map(row => ({ [sel.ref]: row })), expr)
    } else {
      return sel.truncate(data).map(row => sel.resolveData(row, fields))
    }
  }

  async set(name: keyof Tables, query: Query, data: {}) {
    const sel = this.select(name, query)
    data = sel.resolveUpdate(data)
    this.$table(name)
      .filter(row => sel.filter(row))
      .forEach(row => sel.update(row, data))
    this.$save(name)
  }

  async remove(name: keyof Tables, query: Query) {
    const sel = this.select(name, query)
    this.#store[name] = this.$table(name).filter(row => !sel.filter(row))
    this.$save(name)
  }

  async create<T extends keyof Tables>(name: T, data: any) {
    const store = this.$table(name)
    const model = this.model(name)
    const { primary, fields, autoInc } = model
    data = model.format(clone(data))
    if (!Array.isArray(primary) && autoInc && !(primary in data)) {
      const max = store.length ? Math.max(...store.map(row => +row[primary])) : 0
      data[primary] = max + 1
      if (Field.string.includes(fields[primary].type)) {
        data[primary] += ''
      }
    } else {
      const duplicated = await this.get(name, pick(data, makeArray(primary)))
      if (duplicated.length) {
        throw new DriverError('duplicate-entry')
      }
    }
    const copy = model.create(data)
    store.push(copy)
    this.$save(name)
    return clone(copy)
  }

  async upsert(name: keyof Tables, data: any, key: string | string[]) {
    const sel = this.select(name)
    const keys = makeArray(key || sel.model.primary)
    for (const update of sel.resolveUpsert(data)) {
      const row = this.$table(name).find(row => {
        return keys.every(key => row[key] === update[key])
      })
      if (row) {
        sel.update(row, update)
      } else {
        const data = sel.update(sel.model.create(), update)
        await this.create(name, data).catch(noop)
      }
    }
    this.$save(name)
  }
}

export default MemoryDatabase
