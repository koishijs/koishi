import { Dict, makeArray, MaybeArray } from '@koishijs/utils'
import { Eval, Update } from './eval'
import { Model } from './model'
import { Query } from './query'
import { Flatten, Indexable, Keys } from './utils'
import { Direction, Executable, Modifier, Selection, Selector } from './selection'

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

export class Database<S = any> {
  constructor(public models: Dict<Model>, public driver: Driver) {}

  select<T extends Selector<S>>(table: T, query?: Query<Selector.Resolve<S, T>>): Selection<Selector.Resolve<S, T>> {
    return new Selection(this.driver, table, query)
  }

  get<T extends Keys<S>, K extends Keys<S[T]>>(table: T, query: Query<Selector.Resolve<S, T>>, cursor?: Driver.Cursor<K>): Promise<Result<S[T], K>[]> {
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
  /** @deprecated use selection callback instead */
  eval(table: Keys<S>, expr: any, query?: Query): any
  eval(table: Keys<S>, expr: any, query?: Query) {
    return this.select(table, query)
      .evaluate(typeof expr === 'function' ? expr : () => expr)
      .execute()
  }

  drop() {
    return this.driver.drop()
  }

  stats() {
    return this.driver.stats()
  }

  set<T extends Keys<S>>(table: T, query: Query<Selector.Resolve<S, T>>, update: Selection.Yield<S[T], Update<S[T]>>): Promise<void> {
    const sel = this.select(table, query)
    if (typeof update === 'function') update = update(sel.row)
    const primary = makeArray(sel.model.primary)
    if (primary.some(key => key in update)) {
      throw new TypeError(`cannot modify primary key`)
    }
    return new Executable(this.driver, {
      ...sel,
      type: 'set',
      args: [sel.model.format(update)],
    }).execute()
  }

  remove<T extends Keys<S>>(table: T, query: Query<Selector.Resolve<S, T>>): Promise<void> {
    const sel = this.select(table, query)
    return new Executable(this.driver, {
      ...sel,
      type: 'remove',
      args: [],
    }).execute()
  }

  create<T extends Keys<S>>(table: T, data: Partial<S[T]>): Promise<S[T]> {
    const sel = this.select(table)
    return new Executable(this.driver, {
      ...sel,
      type: 'create',
      args: [data],
    }).execute()
  }

  upsert<T extends Keys<S>>(table: T, upsert: Selection.Yield<S[T], Update<S[T]>[]>, keys?: MaybeArray<Keys<Flatten<S[T]>, Indexable>>): Promise<void> {
    const sel = this.select(table)
    if (typeof upsert === 'function') upsert = upsert(sel.row)
    return new Executable(this.driver, {
      ...sel,
      type: 'upsert',
      args: [
        upsert.map(item => sel.model.format(item)),
        makeArray(keys || sel.model.primary),
      ],
    }).execute()
  }
}

export abstract class Driver {
  abstract start(): Promise<void>
  abstract stop(): Promise<void>
  abstract drop(): Promise<void>
  abstract stats(): Promise<Driver.Stats>
  abstract get(sel: Executable, modifier: Modifier): Promise<any>
  abstract eval(sel: Executable, expr: Eval.Expr): Promise<any>
  abstract set(sel: Executable, data: Update): Promise<void>
  abstract remove(sel: Executable): Promise<void>
  abstract create(sel: Executable, data: any): Promise<any>
  abstract upsert(sel: Executable, data: any[], keys: string[]): Promise<void>

  constructor(public models: Dict<Model>) {}

  model(name: string) {
    const model = this.models[name]
    if (model) return model
    throw new TypeError(`unknown table name "${name}"`)
  }

  execute(executable: Executable) {
    const { type, args } = executable
    return this[type as any](executable, ...args)
  }
}
