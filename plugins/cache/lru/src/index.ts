import { Cache, Context, Dict, isNullable, Schema } from 'koishi'
import LRU from 'lru-cache'

class LruCache extends Cache {
  #store: Dict<LRU<string, any>> = Object.create(null)

  constructor(ctx: Context, private config: LruCache.Config) {
    super(ctx)
  }

  start() {}

  stop() {}

  private prepare(table: keyof Cache.Tables) {
    if (this.#store[table]) return
    const config = this.table(table)
    if (!config) return
    this.#store[table] = new LRU({
      max: config.maxSize,
      maxAge: config.maxAge,
    })
  }

  async clear(table: keyof Cache.Tables) {
    delete this.#store[table]
  }

  async get(table: keyof Cache.Tables, key: string) {
    this.prepare(table)
    return this.#store[table]?.get(key)
  }

  async set(table: keyof Cache.Tables, key: string, value: any, maxAge?: number) {
    if (isNullable(value)) {
      return
    }
    this.prepare(table)
    this.#store[table]?.set(key, value, maxAge)
  }

  async del(table: keyof Cache.Tables, key: string) {
    this.prepare(table)
    return this.#store[table]?.del(key)
  }
}

namespace LruCache {
  export const name = 'cache-lru'

  export interface Config {}

  export const Config: Schema<Config> = Schema.object({})
}

export default LruCache
