import * as utils from 'koishi-utils'

export type TableType = keyof Tables

export interface Tables {
  user: User
  group: Group
}

export interface User extends Record<Platform, number> {
  _id: number
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
  type Getter = (id: number, authority: number) => Partial<User>
  const getters: Getter[] = []

  export function extend(getter: Getter) {
    getters.push(getter)
    fields.push(...Object.keys(getter(0, 0)) as any)
  }

  extend((id, authority) => ({
    id,
    authority,
    flag: 0,
    usage: {},
    timers: {},
  }))

  export function create(id: number, authority: number) {
    const result = {} as User
    for (const getter of getters) {
      Object.assign(result, getter(id, authority))
    }
    return result
  }
}

export enum Platform {}

export interface Group {
  id: number
  type: Platform
  flag: number
  assignee: number
}

export namespace Group {
  export enum Flag {
    ignore = 1,
    silent = 4,
  }

  export type Field = keyof Group
  export const fields: Field[] = []
  export type Observed<K extends Field = Field> = utils.Observed<Pick<Group, K>, Promise<void>>
  type Getter = (id: number, assignee: number) => Partial<Group>
  const getters: Getter[] = []

  export function extend(getter: Getter) {
    getters.push(getter)
    fields.push(...Object.keys(getter(0, 0)) as any)
  }

  export function create(id: number, assignee: number) {
    const result = {} as Group
    for (const getter of getters) {
      Object.assign(result, getter(id, assignee))
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
  getUser<K extends User.Field>(type: Platform, id: number, fields?: readonly K[]): Promise<Pick<User, K | '_id'>>
  getUser<K extends User.Field>(type: Platform, id: number, defaultAuthority?: number, fields?: readonly K[]): Promise<Pick<User, K | '_id'>>
  getUsers<K extends User.Field>(type: Platform, fields?: readonly K[]): Promise<Pick<User, K>[]>
  getUsers<K extends User.Field>(type: Platform, ids: readonly number[], fields?: readonly K[]): Promise<Pick<User, K>[]>
  setUser(type: Platform, id: number, data: Partial<User>): Promise<void>

  getGroup<K extends Group.Field>(type: Platform, id: number, fields?: readonly K[]): Promise<Pick<Group, K | 'id' | 'type'>>
  getGroup<K extends Group.Field>(type: Platform, id: number, selfId?: number, fields?: readonly K[]): Promise<Pick<Group, K | 'id' | 'type'>>
  getAllGroups<K extends Group.Field>(assignees?: readonly number[]): Promise<Pick<Group, K>[]>
  getAllGroups<K extends Group.Field>(fields?: readonly K[], assignees?: readonly number[]): Promise<Pick<Group, K>[]>
  setGroup(type: Platform, id: number, data: Partial<Group>): Promise<void>
}

type DatabaseExtensionMethods<I> = {
  [K in keyof Database]?: Database[K] extends (...args: infer R) => infer S ? (this: I & Database, ...args: R) => S : never
}

type DatabaseExtension<T> =
  | ((Database: T) => void)
  | DatabaseExtensionMethods<T extends new (...args: any[]) => infer I ? I : never>

export function extendDatabase<T extends {}>(module: string | T, extension: DatabaseExtension<T>) {
  try {
    const Database = typeof module === 'string' ? require(module).default : module
    if (typeof extension === 'function') {
      extension(Database)
    } else {
      Object.assign(Database.prototype, extension)
    }
  } catch (error) {}
}
