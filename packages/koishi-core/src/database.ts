import * as utils from 'koishi-utils'
import { Platform } from './adapter'

export type TableType = keyof Tables

export interface Tables {
  user: User
  channel: Channel
}

export namespace Tables {
  type IndexType = string | number
  type IndexKeys<O, T = any> = string & { [K in keyof O]: O[K] extends T ? K : never }[keyof O]
  type QueryMap<O> = { [K in keyof O]?: O[K][] }
  export type Index<T extends TableType> = IndexKeys<Tables[T], IndexType>
  export type Query<T extends TableType> = IndexType[] | QueryMap<Tables[T]>
  export type Field<T extends TableType> = string & keyof Tables[T]

  interface Meta<O> {
    primary?: keyof O
    unique?: (keyof O)[]
    type?: 'incremental'
  }

  export const config: { [T in TableType]?: Meta<Tables[T]> } = {}

  export function extend<T extends TableType>(name: T, meta?: Meta<Tables[T]>) {
    config[name] = { primary: 'id', unique: [], type: 'incremental', ...meta } as any
  }

  extend('user')
  extend('channel')

  export function resolveQuery<T extends TableType>(name: T, query: Query<T>): Record<string, any[]> {
    if (!Array.isArray(query)) return query
    const { primary } = config[name]
    return { [primary]: query }
  }
}

export interface User extends Record<Platform, string> {
  id: string
  flag: number
  authority: number
  name: string
  usage: Record<string, number>
  timers: Record<string, number>
}

export namespace User {
  export enum Flag {
    ignore = 1,
  }

  export type Field = keyof User
  export const fields: Field[] = []
  export type Index = Platform | 'name' | 'id'
  export type Observed<K extends Field = Field> = utils.Observed<Pick<User, K>, Promise<void>>
  type Getter = <T extends Index>(type: T, id: string) => Partial<User>
  const getters: Getter[] = []

  export function extend(getter: Getter) {
    getters.push(getter)
    fields.push(...Object.keys(getter(null as never, '0')) as any)
  }

  extend(() => ({
    authority: 0,
    flag: 0,
    usage: {},
    timers: {},
  }))

  export function create<T extends Index>(type: T, id: string) {
    const result = { [type]: id } as Partial<User>
    for (const getter of getters) {
      Object.assign(result, getter(type, id))
    }
    return result as User
  }
}

export interface Channel {
  id: string
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
  type Getter = (type: Platform, id: string) => Partial<Channel>
  const getters: Getter[] = []

  export function extend(getter: Getter) {
    getters.push(getter)
    fields.push(...Object.keys(getter(null as never, '')) as any)
  }

  export function create(type: Platform, id: string) {
    const result = {} as Channel
    for (const getter of getters) {
      Object.assign(result, getter(type, id))
    }
    return result
  }

  extend((type, id) => ({ id: `${type}:${id}`, flag: 0, disable: [] }))
}

type MaybeArray<T> = T | T[]

export interface Database {
  get<T extends TableType, F extends Tables.Field<T>>(table: T, query: Tables.Query<T>, fields?: readonly F[]): Promise<Pick<Tables[T], F>[]>
  remove<T extends TableType>(table: T, query: Tables.Query<T>): Promise<void>
  create<T extends TableType>(table: T, data: Partial<Tables[T]>): Promise<Tables[T]>
  update<T extends TableType>(table: T, data: Partial<Tables[T]>[], key?: Tables.Index<T>): Promise<void>

  getUser<K extends User.Field, T extends User.Index>(type: T, id: string, fields?: readonly K[]): Promise<Pick<User, K | T>>
  getUser<K extends User.Field, T extends User.Index>(type: T, ids: readonly string[], fields?: readonly K[]): Promise<Pick<User, K | T>[]>
  setUser<T extends User.Index>(type: T, id: string, data: Partial<User>): Promise<void>
  createUser<T extends User.Index>(type: T, id: string, data: Partial<User>): Promise<void>
  removeUser<T extends User.Index>(type: T, id: string): Promise<void>

  getChannel<K extends Channel.Field>(type: Platform, id: string, fields?: readonly K[]): Promise<Pick<Channel, K | 'id'>>
  getChannel<K extends Channel.Field>(type: Platform, ids: readonly string[], fields?: readonly K[]): Promise<Pick<Channel, K | 'id'>[]>
  getChannel<K extends Channel.Field>(type: Platform, id: MaybeArray<string>, fields?: readonly K[]): Promise<any>
  getAssignedChannels<K extends Channel.Field>(fields?: readonly K[], assignMap?: Record<string, readonly string[]>): Promise<Pick<Channel, K>[]>
  setChannel(type: Platform, id: string, data: Partial<Channel>): Promise<void>
  createChannel(type: Platform, id: string, data: Partial<Channel>): Promise<void>
  removeChannel(type: Platform, id: string): Promise<void>
}

type Methods<S, T> = {
  [K in keyof S]?: S[K] extends (...args: infer R) => infer U ? (this: T, ...args: R) => U : S[K]
}

export namespace Database {
  export interface Statics {}

  type Constructor<T> = new (...args: any[]) => T
  type ExtensionMethods<T> = Methods<Database, T extends Constructor<infer I> ? I : never>
  type Extension<T> = ((Database: T) => void) | ExtensionMethods<T>

  export function extend<K extends keyof Statics>(module: K, extension: Extension<Statics[K]>): void
  export function extend<T extends Constructor<unknown>>(module: T, extension: Extension<T>): void
  export function extend(module: any, extension: any) {
    let Database: any
    try {
      Database = typeof module === 'string' ? require(module).default : module
    } catch (error) {
      return
    }

    if (typeof extension === 'function') {
      extension(Database)
    } else {
      Object.assign(Database.prototype, extension)
    }
  }
}

/** @deprecated use `Database.extend()` instead */
export const extendDatabase = Database.extend
