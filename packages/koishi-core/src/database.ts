import * as utils from 'koishi-utils'
import { Platform } from './adapter'

export type TableType = keyof Tables

export interface Tables {
  user: User
  channel: Channel
}

export namespace Tables {
  interface Meta<O> {
    type?: 'incremental'
    primary?: keyof O
    unique?: (keyof O)[]
    foreign?: {
      [K in keyof O]: [TableType, string]
    }
  }

  export const config: { [T in TableType]?: Meta<Tables[T]> } = {}

  export function extend<T extends TableType>(name: T, meta?: Meta<Tables[T]>) {
    config[name] = { primary: 'id', unique: [], type: 'incremental', foreign: {}, ...meta } as any
  }

  extend('user')
  extend('channel')
}

export type Query<T extends TableType> = Query.Expr<Tables[T]> | Query.Shorthand

export namespace Query {
  export type IndexType = string | number
  export type IndexKeys<O, T = any> = string & { [K in keyof O]: O[K] extends T ? K : never }[keyof O]
  export type Field<T extends TableType> = string & keyof Tables[T]
  export type Index<T extends TableType> = IndexKeys<Tables[T], IndexType>

  export interface FieldExpr<T> {
    $regex?: RegExp
    $regexFor?: string
    $in?: T[]
    $nin?: T[]
    $eq?: T
    $ne?: T
    $gt?: T
    $gte?: T
    $lt?: T
    $lte?: T
  }

  export interface LogicalExpr<T> {
    $or?: Expr<T>[]
    $and?: Expr<T>[]
    $not?: Expr<T>
  }

  export type Shorthand<T = IndexType> = T | T[] | RegExp
  export type FieldQuery<T> = FieldExpr<T> | Shorthand<T>
  export type Expr<T = any> = LogicalExpr<T> & {
    [K in keyof T]?: FieldQuery<T[K]>
  }

  export function resolve<T extends TableType>(name: T, query: Query<T>): Expr<Tables[T]> {
    if (Array.isArray(query) || query instanceof RegExp || ['string', 'number'].includes(typeof query)) {
      const { primary } = Tables.config[name]
      return { [primary]: query } as any
    }
    return query as any
  }

  export interface Options<T> {
    limit?: number
    offset?: number
    select?: T[]
  }

  export type Modifier<T> = T[] | Options<T>

  export function resolveModifier<T>(modifier: Modifier<T>): Options<T> {
    if (Array.isArray(modifier)) return { select: modifier }
    return modifier || {}
  }

  export interface Database {
    get<T extends TableType, K extends Field<T>>(table: T, query: Query<T>, modifier?: Modifier<K>): Promise<Pick<Tables[T], K>[]>
    remove<T extends TableType>(table: T, query: Query<T>): Promise<void>
    create<T extends TableType>(table: T, data: Partial<Tables[T]>): Promise<Tables[T]>
    update<T extends TableType>(table: T, data: Partial<Tables[T]>[], key?: Index<T>): Promise<void>
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

type MaybeArray<T> = T | readonly T[]

export interface Database extends Query.Database {
  getUser<K extends User.Field, T extends User.Index>(type: T, id: string, modifier?: Query.Modifier<K>): Promise<Pick<User, K | T>>
  getUser<K extends User.Field, T extends User.Index>(type: T, ids: readonly string[], modifier?: Query.Modifier<K>): Promise<Pick<User, K>[]>
  getUser<K extends User.Field, T extends User.Index>(type: T, id: MaybeArray<string>, modifier?: Query.Modifier<K>): Promise<any>
  setUser<T extends User.Index>(type: T, id: string, data: Partial<User>): Promise<void>
  createUser<T extends User.Index>(type: T, id: string, data: Partial<User>): Promise<void>

  getChannel<K extends Channel.Field>(type: Platform, id: string, modifier?: Query.Modifier<K>): Promise<Pick<Channel, K | 'id'>>
  getChannel<K extends Channel.Field>(type: Platform, ids: readonly string[], modifier?: Query.Modifier<K>): Promise<Pick<Channel, K>[]>
  getChannel<K extends Channel.Field>(type: Platform, id: MaybeArray<string>, modifier?: Query.Modifier<K>): Promise<any>
  getAssignedChannels<K extends Channel.Field>(fields?: K[], assignMap?: Record<string, readonly string[]>): Promise<Pick<Channel, K>[]>
  setChannel(type: Platform, id: string, data: Partial<Channel>): Promise<void>
  createChannel(type: Platform, id: string, data: Partial<Channel>): Promise<void>
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
