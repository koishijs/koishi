import * as utils from 'koishi-utils'
import { Platform } from './adapter'

export type TableType = keyof Tables

export interface Tables {
  user: User
  channel: Channel
}

export interface Field<T = any> {
  type: Field.Type<T>
  length?: number
  nullable?: boolean
  initial?: T
}

export namespace Field {
  export const numberTypes: Type[] = ['integer', 'unsigned', 'float', 'double']
  export const stringTypes: Type[] = ['char', 'string', 'text']
  export const dateTypes: Type[] = ['timestamp', 'date', 'time']
  export const objectTypes: Type[] = ['list', 'json']

  export type Type<T = any> =
    | T extends number ? 'integer' | 'unsigned' | 'float' | 'double'
    : T extends string ? 'char' | 'string' | 'text'
    : T extends Date ? 'timestamp' | 'date' | 'time'
    : T extends any[] ? 'list' | 'json'
    : T extends object ? 'json'
    : never
}

export namespace Tables {
  type Unique<K> = (K | K[])[]

  export interface Meta<O = any> {
    type?: 'random' | 'incremental'
    primary?: string & keyof O
    unique?: Unique<string & keyof O>
    foreign?: {
      [K in keyof O]?: [TableType, string]
    }
    fields?: {
      [K in keyof O]?: Field<O[K]>
    }
  }

  export const config: { [T in TableType]?: Meta<Tables[T]> } = {}

  export function extend<T extends TableType>(name: T, meta?: Meta<Tables[T]>): void
  export function extend(name: string, meta: Meta = {}) {
    const { unique = [], foreign, fields } = config[name] || {}
    config[name] = {
      type: 'incremental',
      primary: 'id',
      ...meta,
      unique: [...unique, ...meta.unique || []],
      foreign: { ...foreign, ...meta.foreign },
      fields: { ...fields, ...meta.fields },
    }
  }

  export function create<T extends TableType>(name: T): Tables[T] {
    const { fields } = Tables.config[name]
    const result = {} as Tables[T]
    for (const key in fields) {
      if (fields[key].initial !== undefined) {
        result[key] = utils.clone(fields[key].initial)
      }
    }
    return result
  }

  extend('user', {
    fields: {
      id: { type: 'string', length: 50 },
      name: { type: 'string', length: 50 },
      flag: { type: 'unsigned', length: 20, initial: 0 },
      authority: { type: 'unsigned', length: 4, initial: 0 },
      usage: { type: 'json', initial: {} },
      timers: { type: 'json', initial: {} },
    },
  })

  extend('channel', {
    fields: {
      id: { type: 'string', length: 50 },
      flag: { type: 'unsigned', length: 20, initial: 0 },
      assignee: { type: 'string', length: 50 },
      disable: { type: 'list', initial: [] },
    },
  })
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

  export interface Options<T extends string> {
    limit?: number
    offset?: number
    fields?: T[]
  }

  export type Modifier<T extends string = any> = T[] | Options<T>

  export function resolveModifier<T extends string>(modifier: Modifier<T>): Options<T> {
    if (Array.isArray(modifier)) return { fields: modifier }
    return modifier || {}
  }

  export interface Database {
    get<T extends TableType, K extends Field<T>>(table: T, query: Query<T>, modifier?: Modifier<K>): Promise<Pick<Tables[T], K>[]>
    remove<T extends TableType>(table: T, query: Query<T>): Promise<void>
    create<T extends TableType>(table: T, data: Partial<Tables[T]>): Promise<Tables[T]>
    update<T extends TableType>(table: T, data: Partial<Tables[T]>[], key?: Index<T>): Promise<void>
  }
}

type MaybeArray<T> = T | readonly T[]

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

  /**
   * @deprecated use `Tables.extend('user', { fields })` instead
   */
  export function extend(getter: Getter) {
    getters.push(getter)
    fields.push(...Object.keys(getter(null as never, '0')) as any)
  }

  export function create<T extends Index>(type: T, id: string) {
    const result = Tables.create('user')
    result[type] = id
    for (const getter of getters) {
      Object.assign(result, getter(type, id))
    }
    return result as User
  }

  export interface Datbase {
    getUser<K extends Field, T extends Index>(type: T, id: string, modifier?: Query.Modifier<K>): Promise<Pick<User, K | T>>
    getUser<K extends Field, T extends Index>(type: T, ids: readonly string[], modifier?: Query.Modifier<K>): Promise<Pick<User, K>[]>
    getUser<K extends Field, T extends Index>(type: T, id: MaybeArray<string>, modifier?: Query.Modifier<K>): Promise<any>
    setUser<T extends Index>(type: T, id: string, data: Partial<User>): Promise<void>
    createUser<T extends Index>(type: T, id: string, data: Partial<User>): Promise<void>
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

  /**
   * @deprecated use `Tables.extend('user', { fields })` instead
   */
  export function extend(getter: Getter) {
    getters.push(getter)
    fields.push(...Object.keys(getter(null as never, '')) as any)
  }

  export function create(type: Platform, id: string) {
    const result = Tables.create('channel')
    result.id = `${type}:${id}`
    for (const getter of getters) {
      Object.assign(result, getter(type, id))
    }
    return result
  }

  export interface Database {
    getChannel<K extends Field>(type: Platform, id: string, modifier?: Query.Modifier<K>): Promise<Pick<Channel, K | 'id'>>
    getChannel<K extends Field>(type: Platform, ids: readonly string[], modifier?: Query.Modifier<K>): Promise<Pick<Channel, K>[]>
    getChannel<K extends Field>(type: Platform, id: MaybeArray<string>, modifier?: Query.Modifier<K>): Promise<any>
    getAssignedChannels<K extends Field>(fields?: K[], assignMap?: Record<string, readonly string[]>): Promise<Pick<Channel, K>[]>
    setChannel(type: Platform, id: string, data: Partial<Channel>): Promise<void>
    createChannel(type: Platform, id: string, data: Partial<Channel>): Promise<void>
  }
}

export interface Database extends Query.Database, User.Datbase, Channel.Database {}

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
