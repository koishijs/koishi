import { Database, Query, Tables, clone, makeArray, pick, Context, valueMap, Schema } from 'koishi'
import { LevelDatabase, Config } from './database'
import { logger, executeEval, executeQuery } from './utils'

/**
 * LevelDB database
 * storage format: sublevel(table) -> _makeKey(obj) -> obj
 * TODOs:
 * - support for unique indexes (using #index$table$field -> primary key map)
 * - optimize for indexed reads
 */

declare module 'koishi' {
  interface Database {
    level: LevelDatabase
  }

  interface Modules {
    level: typeof import('.')
  }
}

function isDirectFieldQuery(q: Query.FieldQuery) {
  return typeof q === 'string' || typeof q === 'number'
}

Database.extend(LevelDatabase, {
  async drop(name) {
    if (name) {
      this._dropTable(name)
    } else {
      this._dropAll()
    }
  },

  async get(name, query, modifier) {
    const expr = Query.resolve(name, query)
    const { fields, limit = Infinity, offset = 0 } = Query.resolveModifier(modifier)

    const { primary } = Tables.config[name] as Tables.Config
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
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const [_, value] of table.iterator()) {
      if (executeQuery(expr, value)) {
        result.push(pick(value, fields))
      }
    }
    return result.slice(offset, offset + limit)
  },

  async set(name, query, data) {
    const { primary } = Tables.config[name] as Tables.Config
    if (makeArray(primary).some(key => key in data)) {
      logger.warn('Cannot update primary key')
      return
    }

    const expr = Query.resolve(name, query)
    const table = this.table(name)
    // Direct update
    if (makeArray(primary).every(key => isDirectFieldQuery(expr[key]))) {
      const key = this._makeKey(primary, expr)
      try {
        const value = await table.get(key)
        if (executeQuery(expr, value)) {
          await table.put(key, Object.assign(value, data))
        }
      } catch (e) {
        if (e.notFound !== true) throw e
      }
      return
    }

    const ops: any[] = []
    // @ts-ignore
    for await (const [key, value] of table.iterator()) {
      if (executeQuery(expr, value)) {
        ops.push({ type: 'put', key, value: Object.assign(value, data) })
      }
    }
    await table.batch(ops)
  },

  async remove(name, query) {
    const expr = Query.resolve(name, query)

    const { primary } = Tables.config[name] as Tables.Config
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

    const ops: any[] = []
    // @ts-ignore
    for await (const [key, value] of table.iterator()) {
      if (executeQuery(expr, value)) {
        ops.push({ type: 'del', key })
      }
    }
    await table.batch(ops)
  },

  async create(name, data: any, forced?: boolean) {
    const { primary, fields, autoInc } = Tables.config[name] as Tables.Config
    data = clone(data)
    if (!Array.isArray(primary) && autoInc && !(primary in data)) {
      const max = await this._maxKey(name)
      data[primary] = max + 1
      if (Tables.Field.string.includes(fields[primary].type)) {
        data[primary] += ''
      }
    }
    const key = this._makeKey(primary, data)
    if (!forced && await this._exists(name, key)) return
    const copy = { ...Tables.create(name), ...data }
    await this.table(name).put(key, copy)
    return copy
  },

  async upsert(name, data, key) {
    const { primary } = Tables.config[name] as Tables.Config
    const keys = makeArray(key || Tables.config[name].primary)
    const table = this.table(name)
    for (const item of data) {
      // Direct upsert
      if (makeArray(primary).every(key => key in item)) {
        const key = this._makeKey(primary, item)
        try {
          const value = await table.get(key)
          if (keys.every(key => value[key] === item[key])) {
            await table.put(key, Object.assign(value, item))
          }
        } catch (e) {
          if (e.notFound !== true) throw e
          // @ts-ignore
          await this.create(name, item, true)
        }
        continue
      }

      let insert: boolean = true
      // @ts-ignore
      for await (const [key, value] of table.iterator()) {
        if (keys.every(key => value[key] === item[key])) {
          insert = false
          const { primary } = Tables.config[name] as Tables.Config
          if (makeArray(primary).some(key => (key in data) && value[key] !== data[key])) {
            logger.warn('Cannot update primary key')
            break
          }
          await table.put(key, Object.assign(value, data))
          // Match the behavior here
          // mongo/src/index.ts > upsert() > bulk.find(pick(item, keys)).updateOne({ $set: omit(item, keys) })
          break
        }
      }
      if (insert) {
        // @ts-ignore
        await this.create(name, item, true)
      }
    }
  },

  async aggregate(name, fields, query) {
    const expr = Query.resolve(name, query)
    const result: any[] = []
    const table = this.table(name)
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const [_, value] of table.iterator()) {
      if (executeQuery(expr, value)) {
        result.push(value)
      }
    }
    return valueMap(fields, expr => executeEval(expr, result))
  },
})

export const name = 'level'

export const schema: Schema<Config> = Schema.object({
  path: Schema.string('数据保存的位置').required(),
  separator: Schema.string('主键分隔符').default('#'),
})

export function apply(ctx: Context, config: Config) {
  config = Schema.validate(config, schema)
  ctx.database = new LevelDatabase(ctx.app, config)
}
