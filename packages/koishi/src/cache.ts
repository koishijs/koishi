import { Dict } from '@koishijs/utils'
import { Context, Service } from '@koishijs/core'

export abstract class Cache extends Service {
  private static kConfig = Symbol('cache.config')

  constructor(ctx: Context) {
    super(ctx, 'cache')
  }

  abstract clear<T extends keyof Cache.Tables>(table: T): Promise<void>
  abstract get<T extends keyof Cache.Tables>(table: T, key: string): Promise<Cache.Tables[T]>
  abstract set<T extends keyof Cache.Tables>(table: T, key: string, value: Cache.Tables[T], maxAge?: number): Promise<void>
  abstract del<T extends keyof Cache.Tables>(table: T, key: string): Promise<void>

  get #tables(): Dict<Cache.TableConfig> {
    return this.ctx.app[Cache.kConfig] ||= {}
  }

  table<T extends keyof Cache.Tables>(table: T, config?: Cache.TableConfig) {
    return config ? this.#tables[table] = config : this.#tables[table]
  }
}

export namespace Cache {
  export interface TableConfig {
    maxAge?: number
    maxSize?: number
  }

  export interface Tables {
    misc: any
  }
}
