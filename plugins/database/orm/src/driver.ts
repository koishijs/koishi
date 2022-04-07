import { Dict, Intersect, makeArray, MaybeArray, pick } from '@koishijs/utils'
import { ModelError } from './error'
import { Eval, Row, Update } from './eval'
import { Model } from './model'
import { Modifier, Query } from './query'
import { Flatten, Indexable, Keys } from './utils'

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
}

type Selector<S> = Keys<S> | Selection

namespace Selector {
  export type Resolve<S, T> =
    | T extends Keys<S> ? S[T]
    : T extends Selection<infer U> ? Intersect<U[number]>
    : never

  export type Tuple<S, T> = T extends [infer L, ...infer R] ? [Resolve<S, L>, ...Tuple<S, R>] : never
}

export abstract class Driver<S = any> {
  abstract drop(): Promise<void>
  abstract stats(): Promise<Driver.Stats>
  abstract get<T extends Keys<S>, K extends Keys<S[T]>>(table: T, query: Query<S[T]>, modifier?: Modifier<K>): Promise<Result<S[T], K>[]>
  abstract set<T extends Keys<S>>(table: T, query: Query<S[T]>, data: Update<S[T]>): Promise<void>
  abstract remove<T extends Keys<S>>(table: T, query: Query<S[T]>): Promise<void>
  abstract create<T extends Keys<S>>(table: T, data: Partial<S[T]>): Promise<S[T]>
  abstract upsert<T extends Keys<S>>(table: T, data: Update<S[T]>[], keys?: MaybeArray<Keys<Flatten<S[T]>, Indexable>>): Promise<void>
  abstract eval<T extends Keys<S>, E extends Eval.Any>(table: T, expr: E, query?: Query<S[T]>): Promise<Eval<E>>

  constructor(public model: Model<S>) {}

  select<T extends Selector<S>>(table: T, where?: Query<Selector.Resolve<S, T>>): Selection<[Selector.Resolve<S, T>]>
  select<T extends Selector<S>[]>(tables: T, where?: Selection.Callback<Selector.Tuple<S, T>, boolean>): Selection<Selector.Tuple<S, T>>
  select(name: any): any {
    return new Selection()
  }

  protected resolveTable<T extends Keys<S>>(name: T) {
    const config = this.model.config[name]
    if (config) return config
    throw new ModelError(`unknown table name "${name}"`)
  }

  protected resolveQuery<T extends Keys<S>>(name: T, query: Query<T> = {}): Query.Expr<S[T]> {
    if (Array.isArray(query) || query instanceof RegExp || ['string', 'number'].includes(typeof query)) {
      const { primary } = this.resolveTable(name)
      if (Array.isArray(primary)) {
        throw new ModelError('invalid shorthand for composite primary key')
      }
      return { [primary]: query } as any
    }
    return query as any
  }

  protected resolveModifier<T extends Keys<S>>(name: T, modifier: Modifier): Modifier.Expr {
    if (!modifier) modifier = {}
    if (Array.isArray(modifier)) modifier = { fields: modifier }
    if (modifier.fields) {
      const fields = Object.keys(this.resolveTable(name).fields)
      modifier.fields = modifier.fields.flatMap((key) => {
        if (fields.includes(key)) return key
        const prefix = key + '.'
        return fields.filter(path => path.startsWith(prefix))
      })
    }
    return modifier
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

export type Direction = 'asc' | 'desc'

export namespace Selection {
  export type Rows<T> = T extends [infer L, ...infer R] ? [Row<L>, ...Rows<R>] : never
  export type Callback<S extends unknown[], T = any> = (...rows: Rows<S>) => Eval.Expr<T>

  export type Project<S extends unknown[], T extends Dict<Callback<S>>> = {
    [K in keyof T]: Eval<ReturnType<T[K]>>
  }
}

export class Selection<S extends unknown[] = any[]> {
  #limit: number
  #offset: number

  orderBy(field: Keys<Intersect<S[number]>>, direction?: Direction): this
  orderBy(field: Selection.Callback<S>, direction?: Direction): this
  orderBy(field: string | Function, direction: Direction = 'asc') {
    return this
  }

  project<T extends Keys<Intersect<S[number]>>>(fields: T[]): Selection<[Pick<Intersect<S[number]>, T>]>
  project<T extends Dict<Selection.Callback<S>>>(fields: T): Selection<[Selection.Project<S, T>]>
  project(fields: any): any {
    return this
  }

  limit(limit: number) {
    this.#limit = limit
    return this
  }

  offset(offset: number) {
    this.#offset = offset
    return this
  }
}
