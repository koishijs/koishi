import { Observed } from 'koishi-utils'

export interface Usage {
  last?: number
  count?: number
}

export enum UserFlag {
  ignore = 1,
}

export const userFlags: (keyof typeof UserFlag)[] = ['ignore']

export interface UserData {
  id: number
  flag: number
  authority: number
  usage: Record<string, Usage> & { _date?: number }
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
  usage: {},
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

export const groupFlags: (keyof typeof GroupFlag)[] = ['noCommand', 'noResponse', 'noEmit']

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

export interface UserMethods {
  getUser <K extends UserField> (userId: number, fields?: K[]): Promise<Pick<UserData, K | 'id'>>
  getUser <K extends UserField> (userId: number, defaultAuthority?: number, fields?: K[]): Promise<Pick<UserData, K | 'id'>>
  getUsers <K extends UserField> (fields?: K[]): Promise<Pick<UserData, K>[]>
  getUsers <K extends UserField> (ids: number[], fields?: K[]): Promise<Pick<UserData, K>[]>
  setUser (userId: number, data: Partial<UserData>): Promise<any>
  observeUser <K extends UserField> (user: number | UserData, fields?: K[]): Promise<User<K>>
  observeUser <K extends UserField> (user: number | UserData, defaultAuthority?: number, fields?: K[]): Promise<User<K>>
  getUserCount (): Promise<number>
}

export interface GroupMethods {
  getGroup <K extends GroupField> (groupId: number, fields?: K[]): Promise<Pick<GroupData, K | 'id'>>
  getGroup <K extends GroupField> (groupId: number, selfId?: number, fields?: K[]): Promise<Pick<GroupData, K | 'id'>>
  getAllGroups <K extends GroupField> (assignees?: number[]): Promise<Pick<GroupData, K>[]>
  getAllGroups <K extends GroupField> (fields?: K[], assignees?: number[]): Promise<Pick<GroupData, K>[]>
  setGroup (groupId: number, data: Partial<GroupData>): Promise<any>
  observeGroup <K extends GroupField> (group: number | GroupData, fields?: K[]): Promise<Group<K>>
  observeGroup <K extends GroupField> (group: number | GroupData, selfId?: number, fields?: K[]): Promise<Group<K>>
  getGroupCount (): Promise<number>
}

export interface TableMethods {
  user: UserMethods
  group: GroupMethods
}

export interface TableData {
  user: UserData
  group: GroupData
}

export type TableType = keyof TableMethods
type TableMap = Partial<Record<TableType, SubdatabaseType>>

type UnionToIntersection <U> = (U extends any ? (key: U) => void : never) extends (key: infer I) => void ? I : never

export type Database = Subdatabases & UnionToIntersection<TableMethods[TableType]>

export interface DatabaseConfig {
  $tables?: TableMap
}

export interface Subdatabases {}

export interface InjectOptions {}

type SubdatabaseType = keyof Subdatabases
type DatabaseMap = Record<string | number, AbstractDatabase>
type InjectionMap <S extends SubdatabaseType> = Partial<Record<TableType, DatabaseInjections<S>>>

export type TableConfig <K extends SubdatabaseType> = K extends keyof InjectOptions ? InjectOptions[K] : never
export type InjectConfig <K extends SubdatabaseType> = Partial<Record<TableType, TableConfig<K>>>

interface Subdatabase <T extends SubdatabaseType = SubdatabaseType, A extends AbstractDatabase = AbstractDatabase> {
  new (config: DatabaseConfig[T], injectConfig?: InjectConfig<T>): A
  identify? (config: DatabaseConfig[T]): string | number
  _methods?: InjectionMap<T>
  _options?: InjectConfig<T>
  _manager?: DatabaseManager
}

export interface AbstractDatabase {
  start? (): void | Promise<void>
  stop? (): void | Promise<void>
}

const unknownMethods: { [K in SubdatabaseType]?: DatabaseInjections<K> } = {}
const unknownOptions: { [K in SubdatabaseType]?: TableConfig<K> } = {}
const subdatabases: { [K in SubdatabaseType]?: Subdatabase<K> } = {}
const existingDatabases: { [K in SubdatabaseType]?: DatabaseMap } = {}

export function registerDatabase <K extends SubdatabaseType> (name: K, subdatabase: Subdatabase<K, {}>) {
  subdatabases[name] = subdatabase as any
  subdatabase._methods = unknownMethods[name] ?? {}
  subdatabase._options = unknownOptions[name] ?? {}
}

export type DatabaseInjections <K extends SubdatabaseType, T extends TableType = TableType> = {
  [M in keyof TableMethods[T]]?: TableMethods[T][M] extends (...args: infer P) => infer R
    ? (this: DatabaseInjections<K, T> & Subdatabases[K], ...args: P) => R
    : never
}

export function injectMethods <K extends SubdatabaseType, T extends TableType> (
  name: K,
  table: T,
  methods: DatabaseInjections<K, T>,
  options?: TableConfig<K>,
) {
  const Subdatabase = subdatabases[name] as Subdatabase<K>
  let methodMap: Partial<Record<TableType, DatabaseInjections<K, T>>>
  let optionMap: Partial<Record<TableType, TableConfig<K>>>

  // inject before subdatabase was registered
  if (!Subdatabase) {
    methodMap = unknownMethods[name] || (unknownMethods[name] = {} as never)
    optionMap = unknownOptions[name] || (unknownOptions[name] = {} as never)
  } else {
    optionMap = Subdatabase._options
    if (Subdatabase._manager) {
      // inject after application was created
      Subdatabase._manager.injectMethods(name, table, methods)
      methodMap = {} as any
    } else {
      methodMap = Subdatabase._methods
    }
  }

  methodMap[table] = { ...methodMap[table], ...methods }
  optionMap[table] = { ...optionMap[table] as any, ...options as any }
}

class DatabaseManager {
  public database = {} as Database
  private explicitTables: TableMap
  private implicitTables: TableMap = {}

  constructor (public config: DatabaseConfig) {
    this.explicitTables = config.$tables || {}
    for (const table in this.explicitTables) {
      const name = this.explicitTables[table]
      if (!config[name]) throw new Error(`database "${name}" not configurated`)
    }
    for (const type in subdatabases) {
      this.bindSubdatabase(type as SubdatabaseType, config[type])
    }
  }

  createSubdatabase <S extends SubdatabaseType> (sub: S, config: any) {
    const Subdatabase: Subdatabase<S> = subdatabases[sub]
    const identifier = config.identifier ?? (config.identifier = Subdatabase.identify?.(config))
    const databases: DatabaseMap = existingDatabases[sub] || (existingDatabases[sub] = {} as never)
    return identifier in databases
      ? databases[identifier]
      : databases[identifier] = new Subdatabase({ identifier, ...config }, Subdatabase._options)
  }

  bindSubdatabase <S extends SubdatabaseType> (type: S, config: any) {
    if (!config) return
    const Subdatabase: Subdatabase<S> = subdatabases[type]
    const subdatabase = this.createSubdatabase(type, config)
    this.database[type] = subdatabase as never
    Subdatabase._manager = this
    for (const table in Subdatabase._methods) {
      this.injectMethods(type, table as any, Subdatabase._methods[table])
    }
  }

  injectMethods <S extends SubdatabaseType, T extends TableType> (sub: S, table: T, methods: any) {
    const subdatabase = this.database[sub] as AbstractDatabase
    if (!this.explicitTables[table] && this.implicitTables[table]) {
      throw new Error(`database "${this.implicitTables[table]}" and "${sub}" conflict on table "${table}"`)
    } else if (!this.explicitTables[table] || this.explicitTables[table] === sub) {
      this.implicitTables[table] = sub
      for (const name in methods) {
        subdatabase[name] = this.database[name] = methods[name].bind(subdatabase)
      }
    }
  }
}

export function createDatabase (config: DatabaseConfig) {
  return new DatabaseManager(config).database
}
