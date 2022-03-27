import { Dict, Extract } from '@koishijs/utils'
import { Eval, executeEval } from './eval'
import { Comparable, Indexable } from './utils'

export type Query<T = any> = Query.Expr<T> | Query.Shorthand<Indexable>

export namespace Query {
  export interface FieldExpr<T = any> {
    // logical
    $or?: FieldQuery<T>[]
    $and?: FieldQuery<T>[]
    $not?: FieldQuery<T>

    // membership
    $in?: Extract<T, Indexable, T[]>
    $nin?: Extract<T, Indexable, T[]>

    // arithmatic
    $eq?: Extract<T, Comparable>
    $ne?: Extract<T, Comparable>
    $gt?: Extract<T, Comparable>
    $gte?: Extract<T, Comparable>
    $lt?: Extract<T, Comparable>
    $lte?: Extract<T, Comparable>

    // list
    $el?: T extends (infer U)[] ? FieldQuery<U> : never
    $size?: Extract<T, any[], number>

    // regexp
    $regex?: Extract<T, string, RegExp>
    $regexFor?: Extract<T, string>

    // bitwise
    $bitsAllClear?: Extract<T, number>
    $bitsAllSet?: Extract<T, number>
    $bitsAnyClear?: Extract<T, number>
    $bitsAnySet?: Extract<T, number>
  }

  export interface LogicalExpr<T = any> {
    $or?: Expr<T>[]
    $and?: Expr<T>[]
    $not?: Expr<T>
    $expr?: Eval.Boolean<T>
  }

  export type Shorthand<T = any> =
    | Extract<T, Comparable>
    | Extract<T, Indexable, T[]>
    | Extract<T, string, RegExp>

  export type FieldQuery<T = any> = FieldExpr<T> | Shorthand<T>

  export type Expr<T = any> = LogicalExpr<T> & {
    [K in keyof T]?: FieldQuery<T[K]>
  }
}

type QueryOperators = {
  [K in keyof Query.FieldExpr]?: (query: Query.FieldExpr[K], data: any) => boolean
}

const queryOperators: QueryOperators = {
  // logical
  $or: (query, data) => query.reduce((prev, query) => prev || executeFieldQuery(query, data), false),
  $and: (query, data) => query.reduce((prev, query) => prev && executeFieldQuery(query, data), true),
  $not: (query, data) => !executeFieldQuery(query, data),

  // comparison
  $eq: (query, data) => data.valueOf() === query.valueOf(),
  $ne: (query, data) => data.valueOf() !== query.valueOf(),
  $gt: (query, data) => data.valueOf() > query.valueOf(),
  $gte: (query, data) => data.valueOf() >= query.valueOf(),
  $lt: (query, data) => data.valueOf() < query.valueOf(),
  $lte: (query, data) => data.valueOf() <= query.valueOf(),

  // membership
  $in: (query, data) => query.includes(data),
  $nin: (query, data) => !query.includes(data),

  // regexp
  $regex: (query, data) => query.test(data),
  $regexFor: (query, data) => new RegExp(data, 'i').test(query),

  // bitwise
  $bitsAllSet: (query, data) => (query & data) === query,
  $bitsAllClear: (query, data) => (query & data) === 0,
  $bitsAnySet: (query, data) => (query & data) !== 0,
  $bitsAnyClear: (query, data) => (query & data) !== query,

  // list
  $el: (query, data) => data.some(item => executeFieldQuery(query, item)),
  $size: (query, data) => data.length === query,
}

function executeFieldQuery(query: Query.FieldQuery, data: any) {
  // shorthand syntax
  if (Array.isArray(query)) {
    return query.includes(data)
  } else if (query instanceof RegExp) {
    return query.test(data)
  } else if (typeof query === 'string' || typeof query === 'number' || query instanceof Date) {
    return data.valueOf() === query.valueOf()
  }

  for (const key in query) {
    if (key in queryOperators) {
      if (!queryOperators[key](query[key], data)) return false
    }
  }

  return true
}

export function executeQuery(data: any, query: Query.Expr): boolean {
  const entries: [string, any][] = Object.entries(query)
  return entries.every(([key, value]) => {
    // execute logical query
    if (key === '$and') {
      return (value as Query.Expr[]).reduce((prev, query) => prev && executeQuery(data, query), true)
    } else if (key === '$or') {
      return (value as Query.Expr[]).reduce((prev, query) => prev || executeQuery(data, query), false)
    } else if (key === '$not') {
      return !executeQuery(data, value)
    } else if (key === '$expr') {
      return executeEval(data, value)
    }

    // execute field query
    try {
      if (!(key in data)) return false
      return executeFieldQuery(value, data[key])
    } catch {
      return false
    }
  })
}

export type Modifier<T extends string = string> = T[] | Modifier.Expr<T>

export namespace Modifier {
  export interface Expr<K extends string = string> {
    limit?: number
    offset?: number
    fields?: K[]
    /** @experimental */
    sort?: Dict<'asc' | 'desc'>
  }
}

export function executeSort(data: any[], sort: Dict<'asc' | 'desc'>) {
  return data.sort((a, b) => {
    for (const key in sort) {
      const dir = sort[key] === 'asc' ? 1 : -1
      const x = a[key], y = b[key]
      if (x < y) return -dir
      if (x > y) return dir
    }
    return 0
  })
}
