import { clone, Context, Database, Dict, KoishiError, makeArray, Model, noop, pick, Query, TableType } from 'koishi'
import { executeEval, executeQuery, executeSort, executeUpdate } from '@koishijs/orm-utils'
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

  $table<K extends TableType>(table: K) {
    return this.#store[table] ||= []
  }

  async drop() {
    this.#store = {}
    await this.#loader?.drop()
  }

  async stats() {
    return {}
  }

  $query(name: TableType, query: Query) {
    const expr = this.ctx.model.resolveQuery(name, query)
    return this.$table(name).filter(row => executeQuery(row, expr))
  }

  async get(name: TableType, query: Query, modifier?: Query.Modifier) {
    const { fields, limit = Infinity, offset = 0, sort = {} } = this.ctx.model.resolveModifier(name, modifier)
    return executeSort(this.$query(name, query), sort)
      .map(row => clone(pick(this.ctx.model.parse(name, row), fields)))
      .slice(offset, offset + limit)
  }

  async set(name: TableType, query: Query, data: {}) {
    this.$query(name, query).forEach(row => executeUpdate(row, this.ctx.model.format(name, data)))
    this.$save(name)
  }

  async remove(name: TableType, query: Query) {
    const expr = this.ctx.model.resolveQuery(name, query)
    this.#store[name] = this.$table(name)
      .filter(row => !executeQuery(row, expr))
    this.$save(name)
  }

  async create<T extends TableType>(name: T, data: any) {
    const store = this.$table(name)
    const { primary, fields, autoInc } = this.ctx.model.config[name]
    data = this.ctx.model.format(name, clone(data))
    if (!Array.isArray(primary) && autoInc && !(primary in data)) {
      const max = store.length ? Math.max(...store.map(row => +row[primary])) : 0
      data[primary] = max + 1
      if (Model.Field.string.includes(fields[primary].type)) {
        data[primary] += ''
      }
    } else {
      const duplicated = await this.get(name, pick(data, makeArray(primary)))
      if (duplicated.length) {
        throw new KoishiError('duplicate entry', 'database.duplicate-entry')
      }
    }
    const copy = this.ctx.model.create(name, data)
    store.push(copy)
    this.$save(name)
    return clone(copy)
  }

  async upsert(name: TableType, data: any[], key: string | string[]) {
    const keys = makeArray(key || this.ctx.model.config[name].primary)
    for (const _item of data) {
      const item = this.ctx.model.format(name, _item)
      const row = this.$table(name).find(row => {
        return keys.every(key => row[key] === item[key])
      })
      if (row) {
        executeUpdate(row, item)
      } else {
        const data = this.ctx.model.create(name)
        await this.create(name, executeUpdate(data, item)).catch(noop)
      }
    }
    this.$save(name)
  }

  async eval(name: TableType, expr: any, query: Query) {
    const table = this.$query(name, query)
    return executeEval(table, expr)
  }
}

export default MemoryDatabase
