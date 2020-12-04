import * as utils from 'koishi-utils'

export type TableType = keyof Tables

export interface Tables {
  user: User
  channel: Channel
}

export interface User extends Record<PlatformType, string> {
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
  type Getter = (type: PlatformType, id: string, authority: number) => Partial<User>
  const getters: Getter[] = []

  export function extend(getter: Getter) {
    getters.push(getter)
    fields.push(...Object.keys(getter(null as never, '0', 0)) as any)
  }

  extend((type, id, authority) => ({
    [type]: id,
    authority,
    flag: 0,
    usage: {},
    timers: {},
  }))

  export function create(type: PlatformType, id: string, authority: number) {
    const result = {} as User
    for (const getter of getters) {
      Object.assign(result, getter(type, id, authority))
    }
    return result
  }
}

export interface Platforms {}

export type PlatformType = keyof Platforms

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
  type Getter = (type: PlatformType, id: string, assignee: string) => Partial<Channel>
  const getters: Getter[] = []

  export function extend(getter: Getter) {
    getters.push(getter)
    fields.push(...Object.keys(getter(null as never, '', '')) as any)
  }

  export function create(type: PlatformType, id: string, assignee: string) {
    const result = {} as Channel
    for (const getter of getters) {
      Object.assign(result, getter(type, id, assignee))
    }
    return result
  }

  extend((type, id, assignee) => ({ id: `${type}:${id}`, assignee, flag: 0 }))
}

export interface Database {
  getUser<K extends User.Field, T extends User.Field>(type: T, id: User[T], fields?: readonly K[]): Promise<Pick<User, K | T>>
  getUser<K extends User.Field, T extends User.Field>(type: T, ids: User[T][], fields?: readonly K[]): Promise<Pick<User, K | T>[]>
  getUser(type: string, ids: string | string[], fields?: readonly string[]): Promise<any>
  setUser<T extends User.Field>(type: T, id: User[T], data: Partial<User>): Promise<void>
  setUser(type: PlatformType, id: string, data: Partial<User>): Promise<void>

  getChannel<K extends Channel.Field>(type: PlatformType, id: string, fields?: readonly K[]): Promise<Pick<Channel, K | 'id'>>
  getChannel<K extends Channel.Field>(type: PlatformType, ids: string[], fields?: readonly K[]): Promise<Pick<Channel, K | 'id'>[]>
  getChannelList<K extends Channel.Field>(fields?: readonly K[], type?: PlatformType, assignees?: readonly string[]): Promise<Pick<Channel, K>[]>
  setChannel(type: PlatformType, id: string, data: Partial<Channel>): Promise<void>
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
