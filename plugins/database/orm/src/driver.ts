import { Dict, MaybeArray } from '@koishijs/utils'
import { Update } from './eval'
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
  abstract set<T extends Keys<S>>(table: T, query: Query<S[T]>, data: Selection.Yield<S[T], Update<S[T]>>): Promise<void>
  abstract remove<T extends Keys<S>>(table: T, query: Query<S[T]>): Promise<void>
  abstract create<T extends Keys<S>>(table: T, data: Partial<S[T]>): Promise<S[T]>
  abstract upsert<T extends Keys<S>>(table: T, data: Selection.Yield<S[T], Update<S[T]>[]>, keys?: MaybeArray<Keys<Flatten<S[T]>, Indexable>>): Promise<void>

  constructor(public models: Dict<Model>) {}

  select<T extends Selector<S>>(table: T, query?: Query<Selector.Resolve<S, T>>): Selection<Selector.Resolve<S, T>> {
    return new Selection(this, table, query)
  }

  get<T extends Keys<S>, K extends Keys<S[T]>>(table: T, query: Query<S[T]>, modifier?: Driver.Cursor<K>): Promise<Result<S[T], K>[]>
  get(table: Keys<S>, query: Query, cursor: Driver.Cursor) {
    if (Array.isArray(cursor)) {
      cursor = { fields: cursor }
    } else if (!cursor) {
      cursor = {}
    }

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

  eval<K extends Keys<S>, T>(table: K, expr: Selection.Callback<S[K], T>, query?: Query): Promise<T>
  eval(table: Keys<S>, expr: any, query?: Query): any
  eval(table: Keys<S>, expr: any, query?: Query) {
    return this.select(table, query)
      .evaluate(typeof expr === 'function' ? expr : () => expr)
      .execute()
  }

  model<T extends Keys<S>>(name: T) {
    const model = this.models[name]
    if (model) return model
    throw new TypeError(`unknown table name "${name}"`)
  }
}
