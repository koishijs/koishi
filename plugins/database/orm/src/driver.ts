import { Dict, makeArray, MaybeArray, pick } from '@koishijs/utils'
import { ModelError } from './error'
import { Eval, Update } from './eval'
import { Model } from './model'
import { Modifier, Query } from './query'
import { Flatten, Indexable, Keys } from './utils'

export interface Stats {
  size?: number
  tables?: Dict<TableStats>
}

export interface TableStats {
  count: number
  size: number
}

type Get<S, K> = {
  [P in keyof S as S[P] extends (...args: any) => any ? P : P extends K ? P : never]: S[P]
}

export abstract class Driver<S> {
  abstract drop(): Promise<void>
  abstract stats(): Promise<Stats>
  abstract get<T extends Keys<S>, K extends Keys<S[T]>>(table: T, query: Query<S[T]>, modifier?: Modifier<K>): Promise<Get<S[T], K>[]>
  abstract set<T extends Keys<S>>(table: T, query: Query<S[T]>, data: Update<S[T]>): Promise<void>
  abstract remove<T extends Keys<S>>(table: T, query: Query<S[T]>): Promise<void>
  abstract create<T extends Keys<S>>(table: T, data: Update<S[T]>): Promise<S[T]>
  abstract upsert<T extends Keys<S>>(table: T, data: Update<S[T]>[], keys?: MaybeArray<Keys<Flatten<S[T]>, Indexable>>): Promise<void>
  abstract eval<T extends Keys<S>, E extends Eval.Aggregation<S[T]>>(table: T, expr: E, query?: Query<S[T]>): Promise<Eval<E>>

  constructor(public model: Model<S>) {}

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
