import { Context, Database, Logger, makeArray, noop, Schema, Tables } from 'koishi'
import { DriverError, Executable, executeEval, Field, Query } from '@koishijs/orm'
import { LevelUp } from 'levelup'
import level from 'level'
import sub from 'subleveldown'
import { getStats, resolveLocation } from './runtime'

declare module 'abstract-leveldown' {
  export interface AbstractIterator<K, V> extends AbstractOptions {
    [Symbol.asyncIterator](): AsyncIterator<[K, V]>
  }
}

declare module 'koishi' {
  interface Database {
    level: LevelDatabase
  }
}

class LevelDatabase extends Database {
  public level = this

  #path: string
  #level: LevelUp
  #tables: Record<string, LevelUp>
  #last: Promise<any> = Promise.resolve()

  constructor(public ctx: Context, public config: LevelDatabase.Config) {
    super(ctx)
    this.#path = resolveLocation(config.location)
  }

  async start() {
    // LevelDB will automatically open
    this.#level = level(this.#path)
    this.#tables = Object.create(null)

    this.ctx.on('model', (name) => {
      delete this.#tables[name]
    })
  }

  async stop() {
    await this.#level.close()
  }

  private createValueEncoding(table: keyof Tables) {
    const { fields } = this.model(table)
    const dates = Object.keys(fields).filter(f => ['timestamp', 'date', 'time'].includes(fields[f].type))
    if (!dates.length) {
      return {
        encode: JSON.stringify,
        decode: JSON.parse,
        buffer: false,
        type: 'json',
      }
    } else {
      return {
        encode: JSON.stringify,
        decode: (str: string) => {
          const obj = JSON.parse(str)
          dates.forEach(key => obj[key] = new Date(obj[key]))
          return obj
        },
        buffer: false,
        type: 'json-for-' + table,
      }
    }
  }

  table<K extends keyof Tables>(table: K): LevelUp {
    return this.#tables[table] ??= sub(this.#level, table, { valueEncoding: this.createValueEncoding(table) })
  }

  private async _maxKey<K extends keyof Tables>(table: K) {
    // eslint-disable-next-line no-unreachable-loop
    for await (const [key] of this.table(table).iterator({ reverse: true, limit: 1 })) {
      return +key
    }
    return 0
  }

  private async _exists<K extends keyof Tables>(table: K, key: string) {
    try {
      // Avoid deserialize
      await this.table(table).get(key, { valueEncoding: 'binary' })
      return true
    } catch {
      return false
    }
  }

  private _makeKey(primary: string | string[], data: any) {
    return (Array.isArray(primary)
      ? primary.map(key => data[key]).join(this.config.separator)
      : data[primary])
  }

  async queue<T>(factory: () => Promise<T>): Promise<T> {
    return this.#last = this.#last.catch(noop).then(factory)
  }

  async drop() {
    this.#tables = Object.create(null)
    await this.#level.clear()
  }

  async stats() {
    return getStats(this.#path)
  }

  async #query(sel: Executable) {
    const { model, query } = sel
    const { primary } = model

    // direct read
    const table = this.table(sel.table as any)
    if (makeArray(primary).every(key => isDirectFieldQuery(query[key]))) {
      const { offset, limit } = sel.modifier
      const key = this._makeKey(primary, query)
      if (offset !== 0 || limit <= 0) return []
      try {
        const value = await table.get(key)
        if (sel.filter(value)) return [value]
      } catch (e) {
        if (e.notFound !== true) throw e
      }
      return []
    }

    const result: any[] = []
    for await (const [, value] of table.iterator()) {
      if (sel.filter(value)) result.push(value)
    }
    return result
  }

  async execute(sel: Executable) {
    const { fields, expr } = sel
    const result = await this.#query(sel)
    if (expr) {
      return executeEval(result.map(row => ({ [sel.ref]: row })), expr)
    } else {
      return sel.truncate(result).map(row => sel.resolveData(row, fields))
    }
  }

  async set(name: keyof Tables, query: Query, data: {}) {
    const sel = this.select(name, query)
    const { primary } = this.model(name)
    const table = this.table(name)
    data = sel.resolveUpdate(data)

    // direct update
    if (makeArray(primary).every(key => isDirectFieldQuery(sel.query[key]))) {
      const key = this._makeKey(primary, sel.query)
      try {
        const value = await table.get(key)
        if (sel.filter(value)) {
          await table.put(key, sel.update(value, data))
        }
      } catch (e) {
        if (e.notFound !== true) throw e
      }
      return
    }

    const batch = table.batch()
    for await (const [key, value] of table.iterator()) {
      if (sel.filter(value)) {
        batch.put(key, sel.update(value, data))
      }
    }
    await batch.write()
  }

  async remove(name: keyof Tables, query: Query) {
    const sel = this.select(name, query)
    const { primary } = this.model(name)
    const table = this.table(name)

    // direct delete
    if (makeArray(primary).every(key => isDirectFieldQuery(sel.query[key]))) {
      const key = this._makeKey(primary, sel.query)
      try {
        const value = await table.get(key)
        if (sel.filter(value)) {
          await table.del(key)
        }
      } catch (e) {
        if (e.notFound !== true) throw e
      }
      return
    }

    const batch = table.batch()
    for await (const [key, value] of table.iterator()) {
      if (sel.filter(value)) {
        batch.del(key)
      }
    }
    await batch.write()
  }

  create<T extends keyof Tables>(name: T, data: any, forced?: boolean) {
    return this.queue(async () => {
      const model = this.model(name)
      const { primary, fields, autoInc } = model
      data = model.format(data)
      if (!Array.isArray(primary) && autoInc && !(primary in data)) {
        const max = await this._maxKey(name)
        data[primary] = max + 1
        if (Field.string.includes(fields[primary].type)) {
          data[primary] += ''
        }
      }
      const key = this._makeKey(primary, data)
      if (!forced && await this._exists(name, key)) {
        throw new DriverError('duplicate-entry')
      }

      const copy = model.create(data)
      await this.table(name).put(key, copy)
      return copy
    })
  }

  async upsert(name: keyof Tables, data: any[], key: string | string[]) {
    const sel = this.select(name)
    const { primary } = sel.model
    const keys = makeArray(key || primary)
    const table = this.table(name)
    const batch = table.batch()

    for (const item of sel.resolveUpsert(data)) {
      // direct upsert
      if (makeArray(primary).every(key => key in item)) {
        const key = this._makeKey(primary, item)
        try {
          const value = await table.get(key)
          if (keys.every(key => value[key] === item[key])) {
            batch.put(key, sel.update(value, item))
          }
        } catch (e) {
          if (e.notFound !== true) throw e
          batch.put(key, sel.update(sel.model.create(), item))
        }
        continue
      }

      let insert = true
      for await (const [key, value] of table.iterator()) {
        if (keys.every(key => value[key] === item[key])) {
          insert = false
          batch.put(key, sel.update(value, item))
          break
        }
      }
      if (insert) {
        const data = sel.update(sel.model.create(), item)
        batch.put(this._makeKey(primary, data), data)
      }
    }

    await batch.write()
  }
}

namespace LevelDatabase {
  export interface Config {
    location: string
    separator?: string
  }

  export const Config = Schema.object({
    location: Schema.string().description('数据保存的位置').default('.level'),
    separator: Schema.string().description('主键分隔符').default('#'),
  })
}

export const logger = new Logger('level')

/**
 * LevelDB database
 * storage format: sublevel(table) -> _makeKey(obj) -> obj
 * TODOs:
 * - support for unique indexes (using #index$table$field -> primary key map)
 * - optimize for indexed reads
 */
function isDirectFieldQuery(q: Query.FieldQuery) {
  return typeof q === 'string' || typeof q === 'number'
}

export default LevelDatabase
