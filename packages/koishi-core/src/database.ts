import { Observed } from 'koishi-utils'
import { Activity } from './utils'

export interface Usage {
  last?: number
  count?: number
  date?: string
}

export enum UserFlag {
  ignore = 1,
}

export const userFlags: (keyof typeof UserFlag)[] = ['ignore']

export interface UserData {
  id: number
  name: string
  flag: number
  ignoreEnd: number
  authority: number
  usage: Record<string, Usage>
  talkativeness: Activity
}

export type User<K extends UserField = UserField> = Observed<Pick<UserData, K | 'id'>>
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
  ignoreEnd: 0,
  name: String(id),
  usage: {},
  talkativeness: {},
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
  noCommand = 1,
  noResponse = 2,
  noEmit = 4,
}

export type Group<K extends GroupField = GroupField> = Observed<Pick<GroupData, K | 'id'>>
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
  flag: assignee ? 0 : 3,
}))

export function createGroup (id: number, assignee: number) {
  const result = {} as GroupData
  for (const getter of groupGetters) {
    Object.assign(result, getter(id, assignee))
  }
  return result
}

export interface UserTable {
  getUser <K extends UserField> (userId: number, fields?: K[]): Promise<Pick<UserData, K | 'id'>>
  getUser <K extends UserField> (userId: number, defaultAuthority?: number, fields?: K[]): Promise<Pick<UserData, K | 'id'>>
  getUsers <K extends UserField> (fields?: K[]): Promise<Pick<UserData, K>[]>
  getUsers <K extends UserField> (ids: number[], fields?: K[]): Promise<Pick<UserData, K>[]>
  setUser (userId: number, data: Partial<UserData>): Promise<any>
  observeUser <K extends UserField> (user: number | UserData, fields?: K[]): Promise<User<K>>
  observeUser <K extends UserField> (user: number | UserData, defaultAuthority?: number, fields?: K[]): Promise<User<K>>
  getUserCount (): Promise<number>
}

export interface GroupTable {
  getGroup <K extends GroupField> (groupId: number, fields?: K[]): Promise<Pick<GroupData, K | 'id'>>
  getGroup <K extends GroupField> (groupId: number, selfId?: number, fields?: K[]): Promise<Pick<GroupData, K | 'id'>>
  getAllGroups <K extends GroupField> (assignees?: number[]): Promise<Pick<GroupData, K>[]>
  getAllGroups <K extends GroupField> (fields?: K[], assignees?: number[]): Promise<Pick<GroupData, K>[]>
  setGroup (groupId: number, data: Partial<GroupData>): Promise<any>
  observeGroup <K extends GroupField> (group: number | GroupData, fields?: K[]): Promise<Group<K>>
  observeGroup <K extends GroupField> (group: number | GroupData, selfId?: number, fields?: K[]): Promise<Group<K>>
  getGroupCount (): Promise<number>
}

export interface Tables {
  user: UserTable
  group: GroupTable
}

export interface TableData {
  user: UserData
  group: GroupData
}

export type TableType = keyof Tables

type UnionToIntersection <U> = (U extends any ? (key: U) => void : never) extends (key: infer I) => void ? I : never
type ExtendValues <T extends Record<keyof any, any>, V> = { [K in keyof T]?: T[K] & V }

export type Database = ExtendValues<Subdatabases, AbstractDatabase> & UnionToIntersection<Tables[TableType]>

export interface DatabaseConfig {
  $tables?: Partial<Record<TableType, SubdatabaseType>>
}

export interface Subdatabases {}

type SubdatabaseType = keyof Subdatabases

interface Subdatabase <K extends SubdatabaseType = SubdatabaseType> {
  new (config: K extends keyof DatabaseConfig ? DatabaseConfig[K] : void): Subdatabases[K] & AbstractDatabase
  _injections?: Partial<Record<TableType, {}>>
}

export interface AbstractDatabase {
  identifier: string
  start? (): Promise<void>
  stop? (): void
}

const subdatabases: { [K in SubdatabaseType]?: Subdatabase<K> } = {}

export function registerDatabase <K extends SubdatabaseType> (name: K, subdatabase: Subdatabase<K>) {
  subdatabases[name] = subdatabase as any
  subdatabase._injections = {}
}

type DatabaseInjections <K extends SubdatabaseType, T extends TableType> = {
  [M in keyof Tables[T]]?:
    Tables[T][M] extends (...args: infer P) => infer R ? (this: DatabaseInjections<K, T> & Subdatabases[K], ...args: P) => R : never
}

export function injectMethods <K extends SubdatabaseType, T extends TableType> (name: K, table: T, methods: DatabaseInjections<K, T>) {
  const subdatabase = subdatabases[name] as Subdatabase<K>
  if (!subdatabase) return
  const injections = subdatabase._injections
  if (!injections[table]) injections[table] = {}
  Object.assign(injections[table], methods)
}

export function createDatabase (config: DatabaseConfig) {
  const database = {} as Database
  const explicitTables = config.$tables || {}
  const implicitTables = {} as Partial<Record<TableType, SubdatabaseType>>
  for (const table in explicitTables) {
    const name = explicitTables[table]
    if (!config[name]) throw new Error(`database "${name}" not configurated`)
  }
  for (const type in subdatabases) {
    if (!config[type]) continue
    const injections = (subdatabases[type] as Subdatabase)._injections
    const subdatabase = database[type] = new subdatabases[type](config[type])
    for (const table in injections) {
      if (!explicitTables[table] && implicitTables[table]) {
        throw new Error(`database "${implicitTables[table]}" and "${type}" conflict on table "${table}"`)
      } else if (!explicitTables[table] || explicitTables[table] === type) {
        implicitTables[table] = type
        for (const name in injections[table]) {
          subdatabase[name] = database[name] = injections[table][name].bind(subdatabase)
        }
      }
    }
  }
  return database
}
