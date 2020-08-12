import * as utils from 'koishi-utils'

export type TableType = keyof Tables

export interface Tables {
  user: User
  group: Group
}

export interface User {
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
  export type Observed <K extends Field = Field> = utils.Observed<Pick<User, K>>
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
    name: '' + id,
  }))

  export function create(id: number, authority: number) {
    const result = {} as User
    for (const getter of getters) {
      Object.assign(result, getter(id, authority))
    }
    return result
  }
}

export interface Group {
  id: number
  flag: number
  assignee: number
}

export namespace Group {
  export enum Flag {
    ignore = 1,
    noImage = 2,
    noEmit = 4,
  }

  export type Field = keyof Group
  export const fields: Field[] = []
  export type Observed <K extends Field = Field> = utils.Observed<Pick<Group, K>>
  type Getter = (id: number, authority: number) => Partial<Group>
  const getters: Getter[] = []

  export function extend(getter: Getter) {
    getters.push(getter)
    fields.push(...Object.keys(getter(0, 0)) as any)
  }

  export function create(id: number, authority: number) {
    const result = {} as Group
    for (const getter of getters) {
      Object.assign(result, getter(id, authority))
    }
    return result
  }

  extend((id, assignee) => ({
    id,
    assignee,
    flag: assignee ? 0 : Flag.ignore | Flag.noEmit,
  }))
}

export interface Database {
  getUser <K extends User.Field> (userId: number, fields?: readonly K[]): Promise<Pick<User, K | 'id'>>
  getUser <K extends User.Field> (userId: number, defaultAuthority?: number, fields?: readonly K[]): Promise<Pick<User, K | 'id'>>
  getUsers <K extends User.Field> (fields?: readonly K[]): Promise<Pick<User, K>[]>
  getUsers <K extends User.Field> (ids: readonly number[], fields?: readonly K[]): Promise<Pick<User, K>[]>
  setUser (userId: number, data: Partial<User>): Promise<any>

  getGroup <K extends Group.Field> (groupId: number, fields?: readonly K[]): Promise<Pick<Group, K | 'id'>>
  getGroup <K extends Group.Field> (groupId: number, selfId?: number, fields?: readonly K[]): Promise<Pick<Group, K | 'id'>>
  getAllGroups <K extends Group.Field> (assignees?: readonly number[]): Promise<Pick<Group, K>[]>
  getAllGroups <K extends Group.Field> (fields?: readonly K[], assignees?: readonly number[]): Promise<Pick<Group, K>[]>
  setGroup (groupId: number, data: Partial<Group>): Promise<any>
}

type DatabaseExtension <T extends {}> = {
  [K in keyof Database]?: Database[K] extends (...args: infer R) => infer S ? (this: T & Database, ...args: R) => S : never
}

export function extendDatabase <T extends {}>(module: string, extension: DatabaseExtension<T>, onConstruct?: (this: T) => void): void
export function extendDatabase <T extends {}>(module: { prototype: T }, extension: DatabaseExtension<T>, onConstruct?: (this: T) => void): void
export function extendDatabase(module: any, extension: {}, onConstruct?: () => void) {
  try {
    const Database = typeof module === 'string' ? require(module).default : module
    Object.assign(Database.prototype, extension)
    if (onConstruct) {
      const construct = Database.prototype['construct']
      Database.prototype['construct'] = function (...args: any[]) {
        construct.apply(this, args)
        onConstruct.call(this)
      }
    }
  } catch (error) {}
}
