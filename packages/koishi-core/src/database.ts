import * as utils from 'koishi-utils'

export type TableType = keyof Tables

export interface Tables {
  user: User
  group: Group
}

export interface User extends Record<PlatformKind, string> {
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
  type Getter = (type: PlatformKind, id: string, authority: number) => Partial<User>
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

  export function create(type: PlatformKind, id: string, authority: number) {
    const result = {} as User
    for (const getter of getters) {
      Object.assign(result, getter(type, id, authority))
    }
    return result
  }
}

export interface Platforms {}

export type PlatformKind = keyof Platforms

export interface Group {
  id: string
  type: PlatformKind
  flag: number
  assignee: string
}

export namespace Group {
  export enum Flag {
    ignore = 1,
    silent = 4,
  }

  export type Field = keyof Group
  export const fields: Field[] = []
  export type Observed<K extends Field = Field> = utils.Observed<Pick<Group, K>, Promise<void>>
  type Getter = (type: PlatformKind, id: string, assignee: string) => Partial<Group>
  const getters: Getter[] = []

  export function extend(getter: Getter) {
    getters.push(getter)
    fields.push(...Object.keys(getter(null as never, '0', '0')) as any)
  }

  export function create(type: PlatformKind, id: string, assignee: string) {
    const result = {} as Group
    for (const getter of getters) {
      Object.assign(result, getter(type, id, assignee))
    }
    return result
  }

  extend((id, assignee) => ({
    id,
    assignee,
    flag: 0,
  }))
}

export interface Database {
  getUser<K extends User.Field>(type: PlatformKind, id: string, fields?: readonly K[]): Promise<Pick<User, K>>
  getUsers<K extends User.Field>(type: PlatformKind, ids?: readonly string[], fields?: readonly K[]): Promise<Pick<User, K>[]>
  setUser(type: PlatformKind, id: string, data: Partial<User>): Promise<void>

  getGroup<K extends Group.Field>(type: PlatformKind, id: string, fields?: readonly K[]): Promise<Pick<Group, K | 'id' | 'type'>>
  getAllGroups<K extends Group.Field>(fields?: readonly K[], assignees?: readonly string[]): Promise<Pick<Group, K>[]>
  setGroup(type: PlatformKind, id: string, data: Partial<Group>): Promise<void>
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
