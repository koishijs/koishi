import * as utils from '@koishijs/utils'
import { Awaitable, Dict, Get, makeArray, MaybeArray, pick } from '@koishijs/utils'
import { Query, Tables } from './orm'
import { Context } from './context'
import { KoishiError } from './error'

export interface User {
  id: string
  flag: number
  authority: number
  name: string
  locale: string
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
  guildId: string
  locale: string
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

export abstract class Service {
  protected start(): Awaitable<void> {}
  protected stop(): Awaitable<void> {}

  constructor(protected ctx: Context, key: keyof Context.Services, immediate?: boolean) {
    Context.service(key)
    if (immediate) ctx[key] = this as never

    ctx.on('ready', async () => {
      await this.start()
      if (!immediate) ctx[key] = this as never
    })

    ctx.on('dispose', async () => {
      if (ctx[key] === this as never) ctx[key] = null
      await this.stop()
    })
  }

  get caller(): Context {
    return this[Context.current] || this.ctx
  }
}

export abstract class Database extends Service {
  constructor(ctx: Context) {
    super(ctx, 'database')
  }

  protected resolveTable<T extends keyof Tables>(name: T) {
    const config = this.ctx.model.config[name]
    if (config) return config
    throw new KoishiError(`unknown table name "${name}"`, 'database.unknown-table')
  }

  protected resolveQuery<T extends keyof Tables>(name: T, query: Query<T> = {}): Query.Expr<Tables[T]> {
    if (Array.isArray(query) || query instanceof RegExp || ['string', 'number'].includes(typeof query)) {
      const { primary } = this.resolveTable(name)
      if (Array.isArray(primary)) {
        throw new KoishiError('invalid shorthand for composite primary key', 'model.invalid-query')
      }
      return { [primary]: query } as any
    }
    return query as any
  }

  protected resolveModifier<T extends keyof Tables>(name: T, modifier: Query.Modifier): Query.ModifierExpr {
    if (!modifier) modifier = {}
    if (Array.isArray(modifier)) modifier = { fields: modifier }
    if (modifier.fields) {
      const fields = Object.keys(this.resolveTable(name).fields)
      modifier.fields = modifier.fields.flatMap((key) => {
        if (fields.includes(key)) return key
        const prefix = key + '.'
        return fields.filter(path => path.startsWith(prefix))
      })
    }
    return modifier
  }

  protected resolveUpdate<T extends keyof Tables>(name: T, update: any) {
    const { primary } = this.resolveTable(name)
    if (makeArray(primary).some(key => key in update)) {
      throw new KoishiError(`cannot modify primary key`, 'database.modify-primary-key')
    }
    return this.ctx.model.format(name, update)
  }

  protected resolveData<T extends keyof Tables>(name: T, data: any, fields: string[]) {
    data = this.ctx.model.format(name, data)
    for (const key in this.ctx.model.config[name].fields) {
      data[key] ??= null
    }
    return this.ctx.model.parse(name, pick(data, fields))
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

  /** @deprecated */
  export function extend<K extends keyof Modules>(module: K, extension: Extension<Get<Modules[K], 'default'>>): void
  export function extend<T extends Constructor<unknown>>(module: T, extension: Extension<T>): void
  export function extend(module: any, extension: any) {
    const Database = typeof module === 'string' ? Modules.require(module) : module
    if (!Database) return

    if (typeof extension === 'function') {
      extension(Database)
    } else {
      Object.assign(Database.prototype, extension)
    }
  }
}

export function unwrapExports(module: any) {
  return module?.default || module
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

  export function require(name: string, forced = false) {
    try {
      const path = resolve(name)
      const exports = internal.require(path)
      return unwrapExports(exports)
    } catch (error) {
      if (forced) throw error
    }
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
