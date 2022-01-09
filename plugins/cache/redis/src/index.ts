import { createPool } from 'generic-pool'
import { Cache, Context, Schema, Logger, isNullable } from 'koishi'
import { createClient } from 'redis'
import { RedisClientOptions, RedisClientType } from '@node-redis/client'

class RedisCache extends Cache {
  logger = new Logger('redis')

  pool = createPool<RedisClientType<{}, {}>>({
    create: async () => {
      const client = createClient(this.config)
      await client.connect()
      return client
    },
    destroy: async (client) => {
      await client.disconnect()
    },
  })

  constructor(ctx: Context, private config: RedisCache.Config) {
    super(ctx)
  }

  start() {}

  stop() {}

  private getRedisKey(table: keyof Cache.Tables, key: string) {
    return `${this.config.prefix}${table}:${key}`
  }

  private encode(data: any): string {
    return JSON.stringify(data)
  }

  private decode<T = any>(record: string): T {
    return JSON.parse(record)
  }

  private async doInPool<T>(action: (client: RedisClientType<{}, {}>) => Promise<T>, errActionMessage = 'perform unknown action'): Promise<T> {
    let client: RedisClientType<{}, {}>
    try {
      client = await this.pool.acquire()
    } catch (e) {
      this.logger.warn(`Failed to create Redis connection: ${e.toString()}`)
      return
    }
    if (!client) {
      this.logger.warn(`Failed to create Redis connection: Got empty client`)
      return
    }
    try {
      return await action(client)
    } catch (e) {
      this.logger.warn(`Failed to ${errActionMessage}: ${e.toString()}`)
      return
    } finally {
      await this.pool.release(client)
    }
  }

  async get(table: keyof Cache.Tables, key: string) {
    const redisKey = this.getRedisKey(table, key)
    return this.doInPool(async (client) => {
      const record = await client.get(redisKey)
      if (isNullable(record)) {
        return
      }
      return this.decode(record)
    }, `get ${redisKey}`)
  }

  async set(table: keyof Cache.Tables, key: string, value: any, maxAge?: number) {
    if (isNullable(value)) return
    const tableConfig = this.table(table)
    if (!tableConfig) return
    const age: number = maxAge || tableConfig.maxAge
    const redisKey = this.getRedisKey(table, key)
    return this.doInPool(async (client) => {
      await client.set(redisKey, this.encode(value), age ? { PX: age } : undefined)
    }, `set ${redisKey}`)
  }

  async del(table: keyof Cache.Tables, key: string) {
    const redisKey = this.getRedisKey(table, key)
    return this.doInPool(async (client) => {
      await client.del(redisKey)
    }, `delete ${redisKey}`)
  }

  async clear(table: keyof Cache.Tables) {
    const redisKey = this.getRedisKey(table, '*')
    return this.doInPool(async (client) => {
      const allKeys = await client.keys(redisKey)
      await client.del(allKeys)
    }, `clear table ${redisKey}`)
  }
}

namespace RedisCache {
  export interface Config extends RedisClientOptions<never, {}> {
    prefix?: string
  }

  export const Config = Schema.object({
    url: Schema.string().description('Redis URL').default('redis://localhost:6379'),
    prefix: Schema.string().description('Redis 数据 Key 的前缀').default('koishi:'),
  })
}

export default RedisCache
