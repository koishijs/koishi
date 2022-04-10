import { Flatten, Keys } from './utils'

export function isEvalExpr(value: any): value is Eval.UniveralExpr {
  return Object.keys(value).some(key => key.startsWith('$'))
}

type $Date = Date

export type Uneval<T, U> =
  | U extends number ? Eval.Number<T>
  : U extends string ? Eval.String<T>
  : U extends boolean ? Eval.Boolean<T>
  : U extends $Date ? Eval.Date<T>
  : any

export type Eval<U> =
  | U extends number ? number
  : U extends boolean ? boolean
  : U extends string ? string
  : U extends symbol ? any
  : U extends Eval.NumberExpr ? number
  : U extends Eval.StringExpr ? string
  : U extends Eval.BooleanExpr ? boolean
  : U extends Eval.AggregationExpr ? number
  : never

export namespace Eval {
  export type GeneralExpr = UniveralExpr & NumberExpr & StringExpr & BooleanExpr & AggregationExpr
  export type Number<T = any, A = never> = A | number | NumberExpr<T, A>
  export type String<T = any, A = never> = string | StringExpr<T, A>
  export type Boolean<T = any, A = never> = boolean | BooleanExpr<T, A>
  export type Date<T = any> = $Date | DateExpr<T>
  export type Aggregation<T = any> = Number<{}, AggregationExpr<T>>

  export interface UniveralExpr<T = any, U = any> {
    $?: Keys<Flatten<T>, U>
    $if?: [any, Uneval<T, U>, Uneval<T, U>]
    $ifNull?: Uneval<T, U>[]
  }

  export interface NumberExpr<T = any, A = never> extends UniveralExpr<T, number> {
    $add?: Number<T, A>[]
    $multiply?: Number<T, A>[]
    $subtract?: [Number<T, A>, Number<T, A>]
    $divide?: [Number<T, A>, Number<T, A>]
  }

  export interface StringExpr<T = any, A = never> extends UniveralExpr<T, string> {
    $concat?: String<T, A>[]
  }

  type ComparableBinary<T, A> =
    | [Number<T, A>, Number<T, A>]
    | [String<T, A>, String<T, A>]
    | [Boolean<T, A>, Boolean<T, A>]
    | [Date<T>, Date<T>]

  export interface BooleanExpr<T = any, A = never> extends UniveralExpr<T, boolean> {
    $eq?: ComparableBinary<T, A>
    $ne?: ComparableBinary<T, A>
    $gt?: ComparableBinary<T, A>
    $gte?: ComparableBinary<T, A>
    $lt?: ComparableBinary<T, A>
    $lte?: ComparableBinary<T, A>
  }

  export interface DateExpr<T = any> extends UniveralExpr<T, $Date> {}

  export interface AggregationExpr<T = any> {
    $sum?: Keys<Flatten<T>, number> | NumberExpr<T>
    $avg?: Keys<Flatten<T>, number> | NumberExpr<T>
    $max?: Keys<Flatten<T>, number> | NumberExpr<T>
    $min?: Keys<Flatten<T>, number> | NumberExpr<T>
    $count?: Keys<Flatten<T>> | NumberExpr<T> | StringExpr<T> | BooleanExpr<T>
  }
}

type MapUneval<S, T> = {
  [K in keyof S]?: Uneval<T, S[K]>
}

export type Update<T> = MapUneval<Flatten<T>, T>

type EvalOperators = {
  [K in keyof Eval.GeneralExpr]?: (args: Eval.GeneralExpr[K], data: any) => any
}

function getRecursive(path: string, data: any) {
  let value = data
  for (const key of path.split('.')) {
    if (!value) return
    value = value[key]
  }
  return value
}

const evalOperators: EvalOperators = {
  // universal
  $: getRecursive,
  $if: ([cond, vThen, vElse], data) => executeEval(data, cond) ? executeEval(data, vThen) : executeEval(data, vElse),
  $ifNull: ([value, fallback], data) => executeEval(data, value) ?? executeEval(data, fallback),

  // number
  $add: (args, data) => args.reduce<number>((prev, curr) => prev + executeEval(data, curr), 0),
  $multiply: (args, data) => args.reduce<number>((prev, curr) => prev * executeEval(data, curr), 1),
  $subtract: ([left, right], data) => executeEval(data, left) - executeEval(data, right),
  $divide: ([left, right], data) => executeEval(data, left) - executeEval(data, right),

  // string
  $concat: (args, data) => args.map(arg => executeEval(data, arg)).join(''),

  // boolean
  $eq: ([left, right], data) => executeEval(data, left).valueOf() === executeEval(data, right).valueOf(),
  $ne: ([left, right], data) => executeEval(data, left).valueOf() !== executeEval(data, right).valueOf(),
  $gt: ([left, right], data) => executeEval(data, left).valueOf() > executeEval(data, right).valueOf(),
  $gte: ([left, right], data) => executeEval(data, left).valueOf() >= executeEval(data, right).valueOf(),
  $lt: ([left, right], data) => executeEval(data, left).valueOf() < executeEval(data, right).valueOf(),
  $lte: ([left, right], data) => executeEval(data, left).valueOf() <= executeEval(data, right).valueOf(),

  // aggregation
  $sum: (expr, table: any[]) => table.reduce((prev, curr) => prev + executeAggr(expr, curr), 0),
  $avg: (expr, table: any[]) => table.reduce((prev, curr) => prev + executeAggr(expr, curr), 0) / table.length,
  $min: (expr, table: any[]) => Math.min(...table.map(data => executeAggr(expr, data))),
  $max: (expr, table: any[]) => Math.max(...table.map(data => executeAggr(expr, data))),
  $count: (expr, table: any[]) => new Set(table.map(data => executeAggr(expr, data))).size,
}

function executeEvalExpr(expr: any, data: any) {
  for (const key in expr) {
    if (key in evalOperators) {
      return evalOperators[key](expr[key], data)
    }
  }
  return expr
}

function executeAggr(expr: any, data: any) {
  if (typeof expr === 'string') {
    return getRecursive(expr, data)
  }
  return executeEvalExpr(expr, data)
}

export function executeEval(data: any, expr: any) {
  if (typeof expr === 'number' || typeof expr === 'string' || typeof expr === 'boolean' || expr instanceof Date || expr === null || expr === undefined) {
    return expr
  }
  return executeEvalExpr(expr, data)
}

export function executeUpdate(data: any, update: any) {
  for (const key in update) {
    let root = data
    const path = key.split('.')
    const last = path.pop()
    for (const key of path) {
      root = root[key] ||= {}
    }
    root[last] = executeEval(data, update[key])
  }
  return data
}
