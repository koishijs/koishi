import * as utils from 'koishi-utils'
import { Platform, At } from './server'

export type TableType = keyof Tables

export interface Tables {
  user: User
  channel: Channel
}

export interface User extends Record<Platform, string> {
  id: number
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
  export type Observed<K extends Field = Field> = utils.Observed<Pick<User, K>, Promise<void>>
  type Getter = (type: Platform, id: string) => Partial<User>
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

  export function create(type: Platform, id: string) {
    const result = { [type]: id } as User
    for (const getter of getters) {
      Object.assign(result, getter(type, id))
    }
    return result
  }
}

export interface Channel {
  id: string
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

  extend((type, id) => ({ id: `${type}:${id}`, flag: 0 }))
}

type MaybeArray<T> = T | readonly T[]

export interface Database {
  getUser<K extends User.Field, T extends User.Field>(type: T, id: User[T], fields?: readonly K[]): Promise<Pick<User, K | T>>
  getUser<K extends User.Field, T extends User.Field>(type: T, ids: readonly User[T][], fields?: readonly K[]): Promise<Pick<User, K | T>[]>
  getUser<K extends User.Field>(type: string, id: MaybeArray<string>, fields?: readonly K[]): Promise<any>
  setUser<T extends User.Field>(type: T, id: At<User, T, string>, data: Partial<User>): Promise<void>
  createUser<T extends User.Field>(type: T, id: At<User, T, string>, data: Partial<User>): Promise<void>
  removeUser<T extends User.Field>(type: T, id: At<User, T, string>): Promise<void>

  getChannel<K extends Channel.Field>(type: Platform, id: string, fields?: readonly K[]): Promise<Pick<Channel, K | 'id'>>
  getChannel<K extends Channel.Field>(type: Platform, ids: readonly string[], fields?: readonly K[]): Promise<Pick<Channel, K | 'id'>[]>
  getChannel<K extends Channel.Field>(type: Platform, id: MaybeArray<string>, fields?: readonly K[]): Promise<any>
  getChannelList<K extends Channel.Field>(fields?: readonly K[], type?: Platform, assignees?: readonly string[]): Promise<Pick<Channel, K>[]>
  setChannel(type: Platform, id: string, data: Partial<Channel>): Promise<void>
  createChannel(type: Platform, id: string, data: Partial<Channel>): Promise<void>
  removeChannel(type: Platform, id: string): Promise<void>
}

type DatabaseExtensionMethods<I> = {
  [K in keyof Database]?: Database[K] extends (...args: infer R) => infer S ? (this: I & Database, ...args: R) => S : never
}

type DatabaseExtension<T> =
  | ((Database: T) => void)
  | DatabaseExtensionMethods<T extends new (...args: any[]) => infer I ? I : never>

export function extendDatabase<T extends {}>(module: string | T, extension: DatabaseExtension<T>) {
  let Database: any
  try {
    Database = typeof module === 'string' ? require(module).default : module
  } catch (error) {}

  if (typeof extension === 'function') {
    extension(Database)
  } else {
    Object.assign(Database.prototype, extension)
  }
}
