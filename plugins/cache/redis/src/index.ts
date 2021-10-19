import { createPool } from 'generic-pool'
import { Cache, Context, Schema, Logger, isNullable } from 'koishi'
import { createClient } from 'redis'
import { RedisClientOptions, RedisClientType } from 'redis/dist/lib/client'

export default class RedisCache extends Cache {
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

  constructor(ctx: Context, private config: Config) {
    super(ctx)
  }

  private getRedisKey(table: keyof Cache.Tables, key: string) {
    return `${this.config.prefix}${table}:${key}`
  }

  private encode(data: any): string {
    return JSON.stringify(data)
  }

  private decode<T = any>(record: string): T {
    return JSON.parse(record)
  }

  private async doInPool<T>(action: (client: RedisClientType<{}, {}>) => Promise<T>): Promise<T> {
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
      this.logger.warn(`Client action failed: ${e.toString()}`)
      return
    } finally {
      await this.pool.release(client)
    }
  }

  async get(table: keyof Cache.Tables, key: string) {
    const redisKey = this.getRedisKey(table, key)
    return this.doInPool(async (client) => {
      try {
        const record = await client.get(redisKey)
        if (isNullable(record)) {
          return
        }
        return this.decode(record)
      } catch (e) {
        this.logger.warn(`Failed to get ${redisKey} from redis: ${e.toString()}`)
      }
    })
  }

  async set(table: keyof Cache.Tables, key: string, value: any, maxAge?: number) {
    const tableConfig = this.table(table)
    if (!tableConfig) {
      return
    }
    const age: number = maxAge || tableConfig.maxAge
    const redisKey = this.getRedisKey(table, key)
    return this.doInPool(async (client) => {
      try {
        if (!isNullable(value)) {
          const record = this.encode(value)
          const command = client.multi()
            .set(redisKey, record)
          if (age) {
            command.expire(redisKey, age)
          }
          await command.exec()
        } else {
          await client.del(redisKey)
        }
      } catch (e) {
        this.logger.warn(`Failed to set ${redisKey} to redis: ${e.toString()}`)
      }
    })
  }

  async del(table: keyof Cache.Tables, key: string) {
    const redisKey = this.getRedisKey(table, key)
    return this.doInPool(async (client) => {
      try {
        return client.del(redisKey)
      } catch (e) {
        this.logger.warn(`Failed to delete ${redisKey} from redis: ${e.toString()}`)
      }
    })
  }

  async clear(table: keyof Cache.Tables) {
    const redisKey = this.getRedisKey(table, '*')
    return this.doInPool(async (client) => {
      try {
        const allKeys = await client.keys(redisKey)
        await client.del(allKeys)
      } catch (e) {
        this.logger.warn(`Failed to clear table ${redisKey} in redis: ${e.toString()}`)
      }
    })
  }
}

export const name = 'cache-redis'

export interface Config extends RedisClientOptions<{}, {}> {
  prefix?: string
}

export const schema: Schema<Config> = Schema.object({
  url: Schema.string('Redis URL').default('redis://localhost:6379'),
  prefix: Schema.string('Redis 数据 Key 的前缀').default('koishi:'),
}, true)

export function apply(ctx: Context, config?: Config) {
  ctx.cache = new RedisCache(ctx, Schema.validate(config, schema))
}
