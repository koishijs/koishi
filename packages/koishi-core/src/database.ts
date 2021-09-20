import { MaybeArray, Get, Extract } from 'koishi-utils'
import * as utils from 'koishi-utils'
import { Platform } from './adapter'

export type TableType = keyof Tables

// shared types
type Primitive = string | number
type Comparable = Primitive | Date

type Keys<O, T = any> = string & {
  [K in keyof O]: O[K] extends T ? K : never
}[keyof O]

export interface Tables {
  user: User
  channel: Channel
}

export namespace Tables {
  export interface Field<T = any> {
    type: Field.Type<T>
    length?: number
    nullable?: boolean
    initial?: T
    precision?: number
    scale?: number
  }

  export namespace Field {
    export const number: Type[] = ['integer', 'unsigned', 'float', 'double', 'decimal']
    export const string: Type[] = ['char', 'string', 'text']
    export const date: Type[] = ['timestamp', 'date', 'time']
    export const object: Type[] = ['list', 'json']

    export type Type<T = any> =
      | T extends number ? 'integer' | 'unsigned' | 'float' | 'double' | 'decimal'
      : T extends string ? 'char' | 'string' | 'text'
      : T extends Date ? 'timestamp' | 'date' | 'time'
      : T extends any[] ? 'list' | 'json'
      : T extends object ? 'json'
      : never

    type WithParam<S extends string> = S | `${S}(${any})`

    export type Extension<O = any> = {
      [K in keyof O]?: Field<O[K]> | WithParam<Type<O[K]>>
    }

    export type Config<O = any> = {
      [K in keyof O]?: Field<O[K]>
    }

    const regexp = /^(\w+)(?:\((.+)\))?$/

    export function parse(source: string | Field): Field {
      if (typeof source !== 'string') return source

      // parse string definition
      const capture = regexp.exec(source)
      if (!capture) throw new TypeError('invalid field definition')
      const type = capture[1] as Type
      const args = (capture[2] || '').split(',')
      const field: Field = { type }

      // set default initial value
      if (field.initial === undefined) {
        if (number.includes(field.type)) field.initial = 0
        if (string.includes(field.type)) field.initial = ''
        if (field.type === 'list') field.initial = []
        if (field.type === 'json') field.initial = {}
      }

      // set length information
      if (type === 'decimal') {
        field.precision = +args[0]
        field.scale = +args[1]
      } else if (args[0]) {
        field.length = +args[0]
      }

      return field
    }
  }

  export interface Extension<O = any> {
    type?: 'random' | 'incremental'
    primary?: Keys<O>
    unique?: MaybeArray<Keys<O>>[]
    foreign?: {
      [K in keyof O]?: [TableType, string]
    }
    fields?: Field.Extension<O>
  }

  export interface Config<O = any> extends Extension<O> {
    fields?: Field.Config<O>
  }

  export const config: Record<string, Config> = {}

  export function extend<T extends TableType>(name: T, meta?: Extension<Tables[T]>): void
  export function extend(name: string, meta: Extension = {}) {
    const { primary, type, unique = [], foreign, fields = {} } = meta
    const table = config[name] ||= {
      primary: 'id',
      unique: [],
      foreign: {},
      fields: {},
    }

    table.type = type || table.type
    table.primary = primary || table.primary
    table.unique.push(...unique)
    Object.assign(table.foreign, foreign)

    for (const key in fields) {
      table.fields[key] = Field.parse(fields[key])
    }
  }

  export function create<T extends TableType>(name: T): Tables[T] {
    const { fields, primary } = Tables.config[name]
    const result = {} as Tables[T]
    for (const key in fields) {
      if (key !== primary && fields[key].initial !== undefined) {
        result[key] = utils.clone(fields[key].initial)
      }
    }
    return result
  }

  extend('user', {
    type: 'incremental',
    fields: {
      id: 'string(63)',
      name: 'string(63)',
      flag: 'unsigned(20)',
      authority: 'unsigned(4)',
      usage: 'json',
      timers: 'json',
    },
  })

  extend('channel', {
    fields: {
      id: 'string(63)',
      flag: 'unsigned(20)',
      assignee: 'string(63)',
      disable: 'list',
    },
  })
}

export type Query<T extends TableType> = Query.Expr<Tables[T]> | Query.Shorthand<Primitive>

export namespace Query {
  export type Field<T extends TableType> = string & keyof Tables[T]
  export type Index<T extends TableType> = Keys<Tables[T], Primitive>

  export interface FieldExpr<T = any> {
    // logical
    $or?: FieldQuery<T>[]
    $and?: FieldQuery<T>[]
    $not?: FieldQuery<T>

    // membership
    $in?: Extract<T, Primitive, T[]>
    $nin?: Extract<T, Primitive, T[]>

    // arithmatic
    $eq?: Extract<T, Comparable>
    $ne?: Extract<T, Comparable>
    $gt?: Extract<T, Comparable>
    $gte?: Extract<T, Comparable>
    $lt?: Extract<T, Comparable>
    $lte?: Extract<T, Comparable>

    // list
    $el?: T extends (infer U)[] ? FieldQuery<U> : never
    $size?: Extract<T, any[], number>

    // regexp
    $regex?: Extract<T, string, RegExp>
    $regexFor?: Extract<T, string>

    // bitwise
    $bitsAllClear?: Extract<T, number>
    $bitsAllSet?: Extract<T, number>
    $bitsAnyClear?: Extract<T, number>
    $bitsAnySet?: Extract<T, number>
  }

  export interface LogicalExpr<T = any> {
    $or?: Expr<T>[]
    $and?: Expr<T>[]
    $not?: Expr<T>
    $expr?: Eval.Boolean<T>
  }

  export type Shorthand<T = any> =
    | Extract<T, Comparable>
    | Extract<T, Primitive, T[]>
    | Extract<T, string, RegExp>

  export type FieldQuery<T = any> = FieldExpr<T> | Shorthand<T>
  export type Expr<T = any> = LogicalExpr<T> & {
    [K in keyof T]?: FieldQuery<T[K]>
  }

  export function resolve<T extends TableType>(name: T, query: Query<T> = {}): Expr<Tables[T]> {
    if (Array.isArray(query) || query instanceof RegExp || ['string', 'number'].includes(typeof query)) {
      const { primary } = Tables.config[name]
      return { [primary]: query } as any
    }
    return query as any
  }

  export interface ModifierExpr<K extends string> {
    limit?: number
    offset?: number
    fields?: K[]
  }

  export type Modifier<T extends string> = T[] | ModifierExpr<T>

  export function resolveModifier<K extends string>(modifier: Modifier<K>): ModifierExpr<K> {
    if (Array.isArray(modifier)) return { fields: modifier }
    return modifier || {}
  }

  type Projection<T extends TableType> = Record<string, Eval.Aggregation<Tables[T]>>

  type MapEval<T, P> = {
    [K in keyof P]: Eval<T, P[K]>
  }

  export interface Database {
    drop(table?: TableType): Promise<void>
    get<T extends TableType, K extends Field<T>>(table: T, query: Query<T>, modifier?: Modifier<K>): Promise<Pick<Tables[T], K>[]>
    remove<T extends TableType>(table: T, query: Query<T>): Promise<void>
    create<T extends TableType>(table: T, data: Partial<Tables[T]>): Promise<Tables[T]>
    update<T extends TableType>(table: T, data: Partial<Tables[T]>[], key?: Index<T>): Promise<void>
    aggregate<T extends TableType, P extends Projection<T>>(table: T, fields: P, query?: Query<T>): Promise<MapEval<T, P>>
  }
}

export type Eval<T, U> =
  | U extends number ? number
  : U extends boolean ? boolean
  : U extends string ? Get<T, U>
  : U extends Eval.NumericExpr ? number
  : U extends Eval.BooleanExpr ? boolean
  : U extends Eval.AggregationExpr ? number
  : never

export namespace Eval {
  export type Any<T = any, A = never> = A | number | boolean | Keys<T> | NumericExpr<T, A> | BooleanExpr<T, A>
  export type GeneralExpr = NumericExpr & BooleanExpr & AggregationExpr
  export type Numeric<T = any, A = never> = A | number | Keys<T, number> | NumericExpr<T, A>
  export type Boolean<T = any, A = never> = boolean | Keys<T, boolean> | BooleanExpr<T, A>
  export type Aggregation<T = any> = Any<{}, AggregationExpr<T>>

  export interface NumericExpr<T = any, A = never> {
    $add?: Numeric<T, A>[]
    $multiply?: Numeric<T, A>[]
    $subtract?: [Numeric<T, A>, Numeric<T, A>]
    $divide?: [Numeric<T, A>, Numeric<T, A>]
  }

  export interface BooleanExpr<T = any, A = never> {
    $eq?: [Numeric<T, A>, Numeric<T, A>]
    $ne?: [Numeric<T, A>, Numeric<T, A>]
    $gt?: [Numeric<T, A>, Numeric<T, A>]
    $gte?: [Numeric<T, A>, Numeric<T, A>]
    $lt?: [Numeric<T, A>, Numeric<T, A>]
    $lte?: [Numeric<T, A>, Numeric<T, A>]
  }

  export interface AggregationExpr<T = any> {
    $sum?: Any<T>
    $avg?: Any<T>
    $max?: Any<T>
    $min?: Any<T>
    $count?: Any<T>
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

  export interface Database {
    getUser<K extends Field, T extends Index>(type: T, id: string, modifier?: Query.Modifier<K>): Promise<Pick<User, K | T>>
    getUser<K extends Field, T extends Index>(type: T, ids: string[], modifier?: Query.Modifier<K>): Promise<Pick<User, K>[]>
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

export interface Database extends Query.Database, User.Database, Channel.Database {}

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
