import * as utils from '@koishijs/utils'
import { MaybeArray, Dict, Get } from '@koishijs/utils'
import { Query } from './orm'
import { Context } from './context'

export interface User {
  id: string
  flag: number
  authority: number
  name: string
  usage: Dict<number>
  timers: Dict<number>
}

export namespace User {
  export enum Flag {
    ignore = 1,
  }

  export type Field = keyof User
  export const fields: Field[] = []
  export type Observed<K extends Field = Field> = utils.Observed<Pick<User, K>, Promise<void>>
}

export interface Channel {
  id: string
  platform: string
  flag: number
  assignee: string
}

export namespace Channel {
  export enum Flag {
    ignore = 1,
    silent = 4,
  }

  export type Field = keyof Channel
  export const fields: Field[] = []
  export type Observed<K extends Field = Field> = utils.Observed<Pick<Channel, K>, Promise<void>>
}

export interface Database extends Query.Methods {}

type UserWithPlatform<T extends string, K extends string> = Pick<User, K & User.Field> & Record<T, string>

export abstract class Database {
  protected abstract start(): void | Promise<void>
  protected abstract stop(): void | Promise<void>

  constructor(public ctx: Context) {
    ctx.on('connect', () => this.start())
    ctx.on('disconnect', () => this.stop())
  }

  getUser<T extends string, K extends T | User.Field>(platform: T, id: string, modifier?: Query.Modifier<K>): Promise<UserWithPlatform<T, T | K>>
  getUser<T extends string, K extends T | User.Field>(platform: T, ids: string[], modifier?: Query.Modifier<K>): Promise<UserWithPlatform<T, K>[]>
  async getUser(platform: string, id: MaybeArray<string>, modifier?: Query.Modifier<User.Field>) {
    const data = await this.get('user', { [platform]: id }, modifier)
    return Array.isArray(id) ? data : data[0] && { ...data[0], [platform]: id } as any
  }

  setUser(platform: string, id: string, data: Partial<User>) {
    return this.set('user', { [platform]: id }, data)
  }

  createUser(platform: string, id: string, data: Partial<User>) {
    return this.create('user', { [platform]: id, ...data })
  }

  getChannel<K extends Channel.Field>(platform: string, id: string, modifier?: Query.Modifier<K>): Promise<Pick<Channel, K | 'id' | 'platform'>>
  getChannel<K extends Channel.Field>(platform: string, ids: string[], modifier?: Query.Modifier<K>): Promise<Pick<Channel, K>[]>
  async getChannel(platform: string, id: MaybeArray<string>, modifier?: Query.Modifier<Channel.Field>) {
    const data = await this.get('channel', { platform, id }, modifier)
    return Array.isArray(id) ? data : data[0] && { ...data[0], platform, id }
  }

  getAssignedChannels<K extends Channel.Field>(fields?: K[], assignMap?: Dict<string[]>): Promise<Pick<Channel, K>[]>
  async getAssignedChannels(fields?: Channel.Field[], assignMap: Dict<string[]> = this.ctx.getSelfIds()) {
    return this.get('channel', {
      $or: Object.entries(assignMap).map(([platform, assignee]) => ({ platform, assignee })),
    }, fields)
  }

  setChannel(platform: string, id: string, data: Partial<Channel>) {
    return this.set('channel', { platform, id }, data)
  }

  createChannel(platform: string, id: string, data: Partial<Channel>) {
    return this.create('channel', { platform, id, ...data })
  }
}

export namespace Database {
  type Methods<S, T> = {
    [K in keyof S]?: S[K] extends (...args: infer R) => infer U ? (this: T, ...args: R) => U : S[K]
  }

  type Constructor<T> = new (...args: any[]) => T
  type ExtensionMethods<T> = Methods<Database, T extends Constructor<infer I> ? I : never>
  type Extension<T> = ((Database: T) => void) | ExtensionMethods<T>

  export function extend<K extends keyof Modules>(module: K, extension: Extension<Get<Modules[K], 'default'>>): void
  export function extend<T extends Constructor<unknown>>(module: T, extension: Extension<T>): void
  export function extend(module: any, extension: any) {
    let Database: any
    try {
      Database = typeof module === 'string' ? Modules.require(module).default : module
    } catch {
      return
    }
    if (!Database) return

    if (typeof extension === 'function') {
      extension(Database)
    } else {
      Object.assign(Database.prototype, extension)
    }
  }
}

export interface Modules {}

export namespace Modules {
  const cache: Dict = {}

  export function define(name: string, value: any) {
    cache[name] = value
  }

  export namespace internal {
    export function require(name: string) {
      return cache[name]
    }

    export function resolve(name: string) {
      if (name in cache) return name
      throw new Error(`Cannot find module "${name}"`)
    }

    export function paths(name: string) {
      const prefix1 = 'koishi-plugin-'
      const prefix2 = '@koishijs/plugin-'
      if (name.includes(prefix1) || name.startsWith(prefix2)) {
        // full package path
        return [name]
      } else if (name[0] === '@') {
        // scope package path
        const index = name.indexOf('/')
        return [name.slice(0, index + 1) + prefix1 + name.slice(index + 1)]
      } else {
        // normal package path
        return [prefix1 + name, prefix2 + name]
      }
    }
  }

  export function require(name: string) {
    try {
      const path = resolve(name)
      return internal.require(path)
    } catch {}
  }

  export function resolve(name: string) {
    const modules = internal.paths(name)
    for (const path of modules) {
      try {
        return internal.resolve(path)
      } catch {}
    }
    throw new Error(`cannot resolve plugin "${name}"`)
  }
}

export abstract class Cache {
  private static kConfig = Symbol('cache.config')

  abstract get<T extends keyof Cache.Tables>(table: T, key: string): Promise<Cache.Tables[T]>
  abstract set<T extends keyof Cache.Tables>(table: T, key: string, value: Cache.Tables[T]): Promise<void>

  constructor(protected ctx: Context) {}

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
    channel: utils.Observed<Partial<Channel>>
    user: utils.Observed<Partial<User>>
    config: any
  }

  export class Stub extends Cache {
    async get() {}
    async set() {}
  }
}
