import * as utils from '@koishijs/utils'
import { MaybeArray, Dict, Get } from '@koishijs/utils'
import { Query } from './orm'
import { App } from './app'

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
  host: string
  flag: number
  assignee: string
  disable: string[]
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
  abstract start(): void | Promise<void>
  abstract stop(): void | Promise<void>

  constructor(public app: App) {
    app.before('connect', () => this.start())
    app.before('disconnect', () => this.stop())
  }

  getUser<T extends string, K extends T | User.Field>(host: T, id: string, modifier?: Query.Modifier<K>): Promise<UserWithPlatform<T, T | K>>
  getUser<T extends string, K extends T | User.Field>(host: T, ids: string[], modifier?: Query.Modifier<K>): Promise<UserWithPlatform<T, K>[]>
  async getUser(host: string, id: MaybeArray<string>, modifier?: Query.Modifier<User.Field>) {
    const data = await this.get('user', { [host]: id }, modifier)
    return Array.isArray(id) ? data : data[0] && { ...data[0], [host]: id } as any
  }

  setUser(host: string, id: string, data: Partial<User>) {
    return this.set('user', { [host]: id }, data)
  }

  createUser(host: string, id: string, data: Partial<User>) {
    return this.create('user', { [host]: id, ...data })
  }

  getChannel<K extends Channel.Field>(host: string, id: string, modifier?: Query.Modifier<K>): Promise<Pick<Channel, K | 'id' | 'host'>>
  getChannel<K extends Channel.Field>(host: string, ids: string[], modifier?: Query.Modifier<K>): Promise<Pick<Channel, K>[]>
  async getChannel(host: string, id: MaybeArray<string>, modifier?: Query.Modifier<Channel.Field>) {
    const data = await this.get('channel', { host, id }, modifier)
    return Array.isArray(id) ? data : data[0] && { ...data[0], host, id }
  }

  getAssignedChannels<K extends Channel.Field>(fields?: K[], assignMap?: Dict<string[]>): Promise<Pick<Channel, K>[]>
  async getAssignedChannels(fields?: Channel.Field[], assignMap: Dict<string[]> = this.app.getSelfIds()) {
    return this.get('channel', {
      $or: Object.entries(assignMap).map(([host, assignee]) => ({ host, assignee })),
    }, fields)
  }

  setChannel(host: string, id: string, data: Partial<Channel>) {
    return this.set('channel', { host, id }, data)
  }

  createChannel(host: string, id: string, data: Partial<Channel>) {
    return this.create('channel', { host, id, ...data })
  }
}

export namespace Database {
  type Methods<S, T> = {
    [K in keyof S]?: S[K] extends (...args: infer R) => infer U ? (this: T, ...args: R) => U : S[K]
  }

  type Constructor<T> = new (...args: any[]) => T
  type ExtensionMethods<T> = Methods<Database, T extends Constructor<infer I> ? I : never>
  type Extension<T> = ((Database: T) => void) | ExtensionMethods<T>

  export function extend<K extends keyof Loader>(module: K, extension: Extension<Get<Loader[K], 'default'>>): void
  export function extend<T extends Constructor<unknown>>(module: T, extension: Extension<T>): void
  export function extend(module: any, extension: any) {
    const Database = typeof module === 'string' ? Loader.require(module).default : module
    if (!Database) return

    if (typeof extension === 'function') {
      extension(Database)
    } else {
      Object.assign(Database.prototype, extension)
    }
  }
}

export interface Loader {}

export namespace Loader {
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

export interface Assets {
  types: readonly Assets.Type[]
  upload(url: string, file: string): Promise<string>
  stats(): Promise<Assets.Stats>
}

export namespace Assets {
  export type Type = 'image' | 'audio' | 'video' | 'file'

  export interface Stats {
    assetCount?: number
    assetSize?: number
  }
}

export interface Cache {
  get<T extends keyof Cache.Tables>(table: T, key: string): Cache.Tables[T] | Promise<Cache.Tables[T]>
  set<T extends keyof Cache.Tables>(table: T, key: string, value: Cache.Tables[T]): void | Promise<void>
}

export namespace Cache {
  export interface Tables {
    channel: utils.Observed<Partial<Channel>>
    user: utils.Observed<Partial<User>>
  }
}
