import { Context, Logger, makeArray, noop, Schema } from 'koishi'
import { Driver, DriverError, Eval, Executable, executeEval, executeQuery, executeSort, executeUpdate, Field, Modifier, Query } from '@koishijs/orm'
import { LevelUp } from 'levelup'
import level from 'level'
import sub from 'subleveldown'
import { getStats, resolveLocation } from './runtime'

declare module 'abstract-leveldown' {
  export interface AbstractIterator<K, V> extends AbstractOptions {
    [Symbol.asyncIterator](): AsyncIterator<[K, V]>
  }
}

class LevelDriver extends Driver {
  #path: string
  #level: LevelUp
  #tables: Record<string, LevelUp>
  #last: Promise<any> = Promise.resolve()

  constructor(public ctx: Context, public config: LevelDriver.Config) {
    super(ctx.model, 'level')
    this.#path = resolveLocation(config.location)
    ctx.on('ready', () => this.start())
    ctx.on('dispose', () => this.stop())
  }

  prepare(name: string) {
    delete this.#tables[name]
  }

  async start() {
    // LevelDB will automatically open
    this.#level = level(this.#path)
    this.#tables = Object.create(null)
    super.start()
  }

  async stop() {
    super.stop()
    await this.#level.close()
  }

  private createValueEncoding(table: string) {
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

  collection(table: string): LevelUp {
    return this.#tables[table] ??= sub(this.#level, table, {
      valueEncoding: this.createValueEncoding(table),
    })
  }

  private async _maxKey(table: string) {
    // eslint-disable-next-line no-unreachable-loop
    for await (const [key] of this.collection(table).iterator({ reverse: true, limit: 1 })) {
      return +key
    }
    return 0
  }

  private async _exists(table: string, key: string) {
    try {
      // Avoid deserialize
      await this.collection(table).get(key, { valueEncoding: 'binary' })
      return true
    } catch {
      return false
    }
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
    const { ref, query, table } = sel

    // direct read
    const col = this.collection(table)
    const key = getDirectIndex(sel)
    if (key) {
      try {
        const value = await col.get(key)
        if (executeQuery(value, query, ref)) return [value]
      } catch (e) {
        if (e.notFound !== true) throw e
      }
      return []
    }

    const result: any[] = []
    for await (const [, value] of col.iterator()) {
      if (executeQuery(value, query, ref)) result.push(value)
    }
    return result
  }

  async get(sel: Executable, modifier: Modifier) {
    const { ref, fields } = sel
    const result = await this.#query(sel)
    return executeSort(result, modifier, ref).map(row => sel.resolveData(row, fields))
  }

  async eval(sel: Executable, expr: Eval.Expr) {
    const { ref } = sel
    const result = await this.#query(sel)
    return executeEval(result.map(row => ({ [ref]: row, _: row })), expr)
  }

  async set(sel: Executable, data: any) {
    // direct update
    const { ref, table, query } = sel
    const key = getDirectIndex(sel)
    const col = this.collection(table)
    if (key) {
      try {
        const value = await col.get(key)
        if (executeQuery(value, query, ref)) {
          await col.put(key, executeUpdate(value, data, ref))
        }
      } catch (e) {
        if (e.notFound !== true) throw e
      }
      return
    }

    const batch = col.batch()
    for await (const [key, value] of col.iterator()) {
      if (executeQuery(value, query, ref)) {
        batch.put(key, executeUpdate(value, data, ref))
      }
    }
    await batch.write()
  }

  async remove(sel: Executable) {
    const { ref, table, query } = sel
    const col = this.collection(table)

    // direct delete
    const key = getDirectIndex(sel)
    if (key) {
      try {
        const value = await col.get(key)
        if (executeQuery(value, query, ref)) {
          await col.del(key)
        }
      } catch (e) {
        if (e.notFound !== true) throw e
      }
      return
    }

    const batch = col.batch()
    for await (const [key, value] of col.iterator()) {
      if (executeQuery(value, query, ref)) {
        batch.del(key)
      }
    }
    await batch.write()
  }

  create(sel: Executable, data: any) {
    return this.queue(async () => {
      const { table, model } = sel
      const { primary, fields, autoInc } = model

      if (!Array.isArray(primary) && autoInc && !(primary in data)) {
        const max = await this._maxKey(table)
        data[primary] = max + 1
        if (Field.string.includes(fields[primary].type)) {
          data[primary] += ''
        }
      }

      const key = makeIndex(makeArray(primary), data)
      if (await this._exists(table, key)) {
        throw new DriverError('duplicate-entry')
      }

      const copy = model.create(data)
      await this.collection(table).put(key, copy)
      return copy
    })
  }

  async upsert(sel: Executable, data: any[], keys: string[]) {
    const { model, table, ref } = sel
    const primary = makeArray(model.primary)
    const col = this.collection(table)
    const batch = col.batch()

    for (const item of data) {
      // direct upsert
      if (primary.every(key => key in item)) {
        const key = makeIndex(primary, item)
        try {
          const value = await col.get(key)
          if (keys.every(key => value[key] === item[key])) {
            batch.put(key, executeUpdate(value, item, ref))
          }
        } catch (e) {
          if (e.notFound !== true) throw e
          batch.put(key, executeUpdate(model.create(), item, ref))
        }
        continue
      }

      let insert = true
      for await (const [key, value] of col.iterator()) {
        if (keys.every(key => value[key] === item[key])) {
          insert = false
          batch.put(key, executeUpdate(value, item, ref))
          break
        }
      }
      if (insert) {
        const data = executeUpdate(model.create(), item, ref)
        batch.put(makeIndex(primary, data), data)
      }
    }

    await batch.write()
  }
}

namespace LevelDriver {
  export interface Config {
    location: string
  }

  export const Config = Schema.object({
    location: Schema.string().description('数据保存的位置').default('.level'),
  })
}

export const logger = new Logger('level')

function makeIndex(keys: string[], data: any) {
  return keys.map(key => data[key]).join('#')
}

/**
 * LevelDB database
 * storage format: sublevel(table) -> _makeKey(obj) -> obj
 * TODOs:
 * - support for unique indexes (using #index$table$field -> primary key map)
 * - optimize for indexed reads
 */
function getDirectIndex({ query, model }: Executable) {
  const primary = makeArray(model.primary)
  if (primary.every(key => isDirectFieldQuery(query[key]))) {
    return makeIndex(primary, query)
  }
}

function isDirectFieldQuery(q: Query.FieldQuery) {
  return typeof q === 'string' || typeof q === 'number'
}

export default LevelDriver
