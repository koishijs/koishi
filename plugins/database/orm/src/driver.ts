import { Dict, makeArray, MaybeArray, pick } from '@koishijs/utils'
import { ModelError } from './error'
import { Eval, Update } from './eval'
import { Model } from './model'
import { Query } from './query'
import { Flatten, Indexable, Keys } from './utils'
import { Direction, Executable, Selection, Selector } from './selection'

export type Result<S, K, T = (...args: any) => any> = {
  [P in keyof S as S[P] extends T ? P : P extends K ? P : never]: S[P]
}

export namespace Driver {
  export interface Stats {
    size?: number
    tables?: Dict<TableStats>
  }

  export interface TableStats {
    count: number
    size: number
  }

  export type Cursor<K extends string = never> = K[] | CursorOptions<K>

  export interface CursorOptions<K> {
    limit?: number
    offset?: number
    fields?: K[]
    sort?: Dict<Direction>
  }
}

export abstract class Driver<S = any> {
  abstract drop(): Promise<void>
  abstract stats(): Promise<Driver.Stats>
  abstract execute(executable: Executable): Promise<any>
  abstract set<T extends Keys<S>>(table: T, query: Query<S[T]>, data: Update<S[T]>): Promise<void>
  abstract remove<T extends Keys<S>>(table: T, query: Query<S[T]>): Promise<void>
  abstract create<T extends Keys<S>>(table: T, data: Partial<S[T]>): Promise<S[T]>
  abstract upsert<T extends Keys<S>>(table: T, data: Update<S[T]>[], keys?: MaybeArray<Keys<Flatten<S[T]>, Indexable>>): Promise<void>
  /** @deprecated use select api instead */
  abstract eval<T extends Keys<S>, E extends Eval.Any>(table: T, expr: E, query?: Query<S[T]>): Promise<Eval<E>>

  constructor(public model: Model<S>) {}

  select<T extends Selector<S>>(table: T, query?: Query<Selector.Resolve<S, T>>): Selection<Selector.Resolve<S, T>> {
    return new Selection(this, table, query)
  }

  get<T extends Keys<S>, K extends Keys<S[T]>>(table: T, query: Query<S[T]>, modifier?: Driver.Cursor<K>): Promise<Result<S[T], K>[]>
  get(table: Keys<S>, query: Query, cursor: Driver.Cursor = {}) {
    if (Array.isArray(cursor)) cursor = { fields: cursor }
    const selection = this.select(table, query)
    if (cursor.fields) selection.project(cursor.fields)
    if (cursor.limit !== undefined) selection.limit(cursor.limit)
    if (cursor.offset !== undefined) selection.offset(cursor.offset)
    if (cursor.sort) {
      for (const field in cursor.sort) {
        selection.orderBy(field as any, cursor.sort[field])
      }
    }
    return selection.execute()
  }

  resolveTable<T extends Keys<S>>(name: T) {
    const config = this.model.config[name]
    if (config) return config
    throw new ModelError(`unknown table name "${name}"`)
  }

  protected resolveUpdate<T extends Keys<S>>(name: T, update: any) {
    const { primary } = this.resolveTable(name)
    if (makeArray(primary).some(key => key in update)) {
      throw new ModelError(`cannot modify primary key`)
    }
    return this.model.format(name, update)
  }

  protected resolveData<T extends Keys<S>>(name: T, data: any, fields: string[]) {
    data = this.model.format(name, data)
    for (const key in this.model.config[name].fields) {
      data[key] ??= null
    }
    return this.model.parse(name, pick(data, fields))
  }
}
