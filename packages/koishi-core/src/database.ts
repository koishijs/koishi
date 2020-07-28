import { Observed } from 'koishi-utils'

export type TableType = keyof Tables

export interface Tables {
  user: UserData
  group: GroupData
}

export enum UserFlag {
  ignore = 1,
}

export interface UserData {
  id: number
  flag: number
  authority: number
  name: string
  usage: Record<string, number>
  timers: Record<string, number>
}

export type User<K extends UserField = UserField> = Observed<Pick<UserData, K>>
export type UserField = keyof UserData
export const userFields: UserField[] = []

type UserGetter = (id: number, authority: number) => Partial<UserData>
const userGetters: UserGetter[] = []

export function extendUser (getter: UserGetter) {
  userGetters.push(getter)
  userFields.push(...Object.keys(getter(0, 0)) as any)
}

extendUser((id, authority) => ({
  id,
  authority,
  flag: 0,
  usage: {},
  timers: {},
  name: '' + id,
}))

export function createUser (id: number, authority: number) {
  const result = {} as UserData
  for (const getter of userGetters) {
    Object.assign(result, getter(id, authority))
  }
  return result
}

export interface GroupData {
  id: number
  flag: number
  assignee: number
}

export enum GroupFlag {
  ignore = 1,
  noImage = 2,
  noEmit = 4,
}

export type Group<K extends GroupField = GroupField> = Observed<Pick<GroupData, K>>
export type GroupField = keyof GroupData
export const groupFields: GroupField[] = []

type GroupGetter = (id: number, assignee: number) => Partial<GroupData>
const groupGetters: GroupGetter[] = []

export function extendGroup (getter: GroupGetter) {
  groupGetters.push(getter)
  groupFields.push(...Object.keys(getter(0, 0)) as any)
}

extendGroup((id, assignee) => ({
  id,
  assignee,
  flag: assignee ? 0 : GroupFlag.ignore | GroupFlag.noEmit,
}))

export function createGroup (id: number, assignee: number) {
  const result = {} as GroupData
  for (const getter of groupGetters) {
    Object.assign(result, getter(id, assignee))
  }
  return result
}

export interface Database {
  getUser <K extends UserField> (userId: number, fields?: readonly K[]): Promise<Pick<UserData, K | 'id'>>
  getUser <K extends UserField> (userId: number, defaultAuthority?: number, fields?: readonly K[]): Promise<Pick<UserData, K | 'id'>>
  getUsers <K extends UserField> (fields?: readonly K[]): Promise<Pick<UserData, K>[]>
  getUsers <K extends UserField> (ids: readonly number[], fields?: readonly K[]): Promise<Pick<UserData, K>[]>
  setUser (userId: number, data: Partial<UserData>): Promise<any>

  getGroup <K extends GroupField> (groupId: number, fields?: readonly K[]): Promise<Pick<GroupData, K | 'id'>>
  getGroup <K extends GroupField> (groupId: number, selfId?: number, fields?: readonly K[]): Promise<Pick<GroupData, K | 'id'>>
  getAllGroups <K extends GroupField> (assignees?: readonly number[]): Promise<Pick<GroupData, K>[]>
  getAllGroups <K extends GroupField> (fields?: readonly K[], assignees?: readonly number[]): Promise<Pick<GroupData, K>[]>
  setGroup (groupId: number, data: Partial<GroupData>): Promise<any>
}
