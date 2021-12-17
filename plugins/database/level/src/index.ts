import { clone, Context, Database, KoishiError, Logger, makeArray, Model, noop, pick, Query, Schema, Tables, TableType, valueMap } from 'koishi'
import { executeUpdate, executeEval, executeQuery } from '@koishijs/orm-utils'
import { LevelUp } from 'levelup'
import level from 'level'
import sub from 'subleveldown'
import { resolveLocation } from './runtime'

declare module 'abstract-leveldown' {
  export interface AbstractIterator<K, V> extends AbstractOptions {
    [Symbol.asyncIterator](): AsyncIterator<[K, V]>
  }
}

declare module 'koishi' {
  interface Database {
    level: LevelDatabase
  }

  interface Modules {
    'database-level': typeof import('.')
  }
}

class LevelDatabase extends Database {
  public level = this

  #level: LevelUp
  #tables: Record<string, LevelUp>
  #last: Promise<any> = Promise.resolve()

  constructor(public ctx: Context, public config: LevelDatabase.Config) {
    super(ctx)
  }

  async start() {
    // LevelDB will automatically open
    this.#level = level(resolveLocation(this.config.location))
    this.#tables = Object.create(null)

    this.ctx.on('model', (name) => {
      delete this.#tables[name]
    })
  }

  async stop() {
    await this.#level.close()
  }

  private createValueEncoding(table: string) {
    const { fields } = this.ctx.model.config[table]
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

  table<K extends TableType>(table: K): LevelUp {
    return this.#tables[table] ??= sub(this.#level, table, { valueEncoding: this.createValueEncoding(table) })
  }

  private async _maxKey<K extends TableType>(table: K) {
    for await (const [key] of this.table(table).iterator({ reverse: true, limit: 1 })) {
      return +key
    }
    return 0
  }

  private async _exists<K extends TableType>(table: K, key: string) {
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

  async drop(name: keyof Tables) {
    if (name) {
      await this.table(name).clear()
      delete this.#tables[name]
    } else {
      this.#tables = Object.create(null)
      await this.#level.clear()
    }
  }

  async get(name: keyof Tables, query: Query, modifier: Query.Modifier) {
    const expr = this.ctx.model.resolveQuery(name, query)
    const { fields, limit = Infinity, offset = 0 } = Query.resolveModifier(modifier)

    const { primary } = this.ctx.model.config[name]
    const table = this.table(name)
    // Direct read
    if (makeArray(primary).every(key => isDirectFieldQuery(expr[key]))) {
      const key = this._makeKey(primary, expr)
      try {
        const value = await table.get(key)
        if (offset === 0 && limit > 0 && executeQuery(expr, value)) {
          return [pick(value, fields)]
        }
      } catch (e) {
        if (e.notFound !== true) throw e
      }
      return []
    }

    const result: any[] = []
    for await (const [, value] of table.iterator()) {
      if (executeQuery(expr, value)) {
        result.push(pick(value, fields))
      }
    }
    return result.slice(offset, offset + limit)
  }

  async set(name: keyof Tables, query: Query, data: {}) {
    const { primary } = this.ctx.model.config[name]
    if (makeArray(primary).some(key => key in data)) {
      logger.warn('Cannot update primary key')
      return
    }

    const expr = this.ctx.model.resolveQuery(name, query)
    const table = this.table(name)
    // Direct update
    if (makeArray(primary).every(key => isDirectFieldQuery(expr[key]))) {
      const key = this._makeKey(primary, expr)
      try {
        const value = await table.get(key)
        if (executeQuery(expr, value)) {
          await table.put(key, executeUpdate(data, value))
        }
      } catch (e) {
        if (e.notFound !== true) throw e
      }
      return
    }

    const batch = table.batch()
    for await (const [key, value] of table.iterator()) {
      if (executeQuery(expr, value)) {
        batch.put(key, executeUpdate(data, value))
      }
    }
    await batch.write()
  }

  async remove(name: keyof Tables, query: Query) {
    const expr = this.ctx.model.resolveQuery(name, query)

    const { primary } = this.ctx.model.config[name]
    const table = this.table(name)
    // Direct delete
    if (makeArray(primary).every(key => isDirectFieldQuery(expr[key]))) {
      const key = this._makeKey(primary, expr)
      try {
        const value = await table.get(key)
        if (executeQuery(expr, value)) {
          await table.del(key)
        }
      } catch (e) {
        if (e.notFound !== true) throw e
      }
      return
    }

    const batch = table.batch()
    for await (const [key, value] of table.iterator()) {
      if (executeQuery(expr, value)) {
        batch.del(key)
      }
    }
    await batch.write()
  }

  create(name: keyof Tables, data: any, forced?: boolean) {
    return this.queue(async () => {
      const { primary, fields, autoInc } = this.ctx.model.config[name]
      data = clone(data)
      if (!Array.isArray(primary) && autoInc && !(primary in data)) {
        const max = await this._maxKey(name)
        data[primary] = max + 1
        if (Model.Field.string.includes(fields[primary].type)) {
          data[primary] += ''
        }
      }
      const key = this._makeKey(primary, data)
      if (!forced && await this._exists(name, key)) {
        throw new KoishiError('duplicate entry', 'database.duplicate-entry')
      }

      const copy = { ...this.ctx.model.create(name), ...data }
      await this.table(name).put(key, copy)
      return copy
    })
  }

  async upsert(name: keyof Tables, data: any[], key: string | string[]) {
    const { primary } = this.ctx.model.config[name]
    const keys = makeArray(key || primary)
    const table = this.table(name)
    for (const item of data) {
      // Direct upsert
      if (makeArray(primary).every(key => key in item)) {
        const key = this._makeKey(primary, item)
        try {
          const value = await table.get(key)
          if (keys.every(key => value[key] === item[key])) {
            await table.put(key, executeUpdate(item, value))
          }
        } catch (e) {
          if (e.notFound !== true) throw e
          const data = this.ctx.model.create(name)
          await this.create(name, executeUpdate(item, data), true)
        }
        continue
      }

      let insert: boolean = true
      for await (const [key, value] of table.iterator()) {
        if (keys.every(key => value[key] === item[key])) {
          insert = false
          const { primary } = this.ctx.model.config[name]
          if (makeArray(primary).some(key => (key in data) && value[key] !== data[key])) {
            logger.warn('Cannot update primary key')
            break
          }
          await table.put(key, executeUpdate(data, value))
          // Match the behavior here
          // mongo/src/index.ts > upsert() > bulk.find(pick(item, keys)).updateOne({ $set: omit(item, keys) })
          break
        }
      }
      if (insert) {
        await this.create(name, item, true)
      }
    }
  }

  async aggregate(name: keyof Tables, fields: {}, query: Query) {
    const expr = this.ctx.model.resolveQuery(name, query)
    const result: any[] = []
    const table = this.table(name)
    for await (const [, value] of table.iterator()) {
      if (executeQuery(expr, value)) {
        result.push(value)
      }
    }
    return valueMap(fields, value => executeEval(value, result)) as any
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
