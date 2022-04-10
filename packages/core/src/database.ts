import * as utils from '@koishijs/utils'
import { Awaitable, Dict, Get, MaybeArray } from '@koishijs/utils'
import { Driver, Model, Modifier, Result, Update } from '@koishijs/orm'
import { Context } from './context'

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

export interface Tables {
  user: User
  channel: Channel
}

export class ModelService extends Model<Tables> {
  constructor(protected ctx: Context) {
    super()

    this.extend('user', {
      id: 'string(63)',
      name: 'string(63)',
      flag: 'unsigned(20)',
      authority: 'unsigned(4)',
      locale: 'string(63)',
    }, {
      autoInc: true,
    })

    this.extend('channel', {
      id: 'string(63)',
      platform: 'string(63)',
      flag: 'unsigned(20)',
      assignee: 'string(63)',
      guildId: 'string(63)',
      locale: 'string(63)',
    }, {
      primary: ['id', 'platform'],
    })
  }

  extend<K extends keyof Tables>(name: K, fields?: Model.Field.Extension<Tables[K]>, extension?: Model.Extension<Tables[K]>) {
    super.extend(name, fields, extension)
    this.ctx.emit('model', name)
  }
}

export abstract class Service {
  protected start(): Awaitable<void> {}
  protected stop(): Awaitable<void> {}

  constructor(protected ctx: Context, public name: keyof Context.Services, public immediate?: boolean) {
    Context.service(name)

    ctx.on('ready', async () => {
      await this.start()
      ctx[name] = this as never
    })

    ctx.on('dispose', async () => {
      if (ctx[name] === this as never) ctx[name] = null
      await this.stop()
    })
  }

  get caller(): Context {
    return this[Context.current] || this.ctx
  }
}

export abstract class Database extends Driver<Tables> {
  protected start(): Awaitable<void> {}
  protected stop(): Awaitable<void> {}

  constructor(protected ctx: Context) {
    super(ctx.model)

    ctx.on('ready', async () => {
      await this.start()
      ctx.database = this
    })

    ctx.on('dispose', async () => {
      if (ctx.database === this) ctx.database = null
      await this.stop()
    })
  }

  getUser<T extends string, K extends User.Field>(platform: T, id: string, modifier?: Modifier<K>): Promise<Result<User, K> & Record<T, string>>
  getUser<T extends string, K extends User.Field>(platform: T, ids: string[], modifier?: Modifier<K>): Promise<Result<User, K>[]>
  async getUser(platform: string, id: MaybeArray<string>, modifier?: Modifier<User.Field>) {
    const data = await this.get('user', { [platform]: id }, modifier)
    if (Array.isArray(id)) return data
    if (data[0]) Object.assign(data[0], { [platform]: id })
    return data[0] as any
  }

  setUser(platform: string, id: string, data: Update<User>) {
    return this.set('user', { [platform]: id }, data)
  }

  createUser(platform: string, id: string, data: Partial<User>) {
    return this.create('user', { [platform]: id, ...data })
  }

  getChannel<K extends Channel.Field>(platform: string, id: string, modifier?: Modifier<K>): Promise<Result<Channel, K | 'id' | 'platform'>>
  getChannel<K extends Channel.Field>(platform: string, ids: string[], modifier?: Modifier<K>): Promise<Result<Channel, K>[]>
  async getChannel(platform: string, id: MaybeArray<string>, modifier?: Modifier<Channel.Field>) {
    const data = await this.get('channel', { platform, id }, modifier)
    if (Array.isArray(id)) return data
    if (data[0]) Object.assign(data[0], { platform, id })
    return data[0]
  }

  getAssignedChannels<K extends Channel.Field>(fields?: K[], assignMap?: Dict<string[]>): Promise<Result<Channel, K>[]>
  async getAssignedChannels(fields?: Channel.Field[], assignMap: Dict<string[]> = this.ctx.getSelfIds()) {
    return this.get('channel', {
      $or: Object.entries(assignMap).map(([platform, assignee]) => ({ platform, assignee })),
    }, fields)
  }

  setChannel(platform: string, id: string, data: Update<Channel>) {
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
