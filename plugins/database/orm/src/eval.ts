import { Common, Flatten } from './utils'

export function isEvalExpr(value: any): value is Eval.Expr {
  return Object.keys(value).some(key => key.startsWith('$'))
}

type $Date = Date

export type Uneval<U> =
  | U extends number ? Eval.Number
  : U extends string ? Eval.String
  : U extends boolean ? Eval.Boolean
  : U extends $Date ? Eval.Date
  : any

export type Eval<U> =
  | U extends Common ? U
  : U extends Eval.Expr<infer T> ? T
  : never

const kExpr = Symbol('expr')
const kType = Symbol('type')

export namespace Eval {
  export interface Expr<T = any> {
    [kExpr]: true
    [kType]?: T
  }

  export type Number = number | Expr<number>
  export type String = string | Expr<string>
  export type Boolean = boolean | Expr<boolean>
  export type Date = $Date | Expr<$Date>
  export type Any = Common | Expr

  export interface Static {
    (key: string, value: any): Eval.Expr

    // univeral
    if<T extends Common>(cond: Any, vThen: T | Expr<T>, vElse: T | Expr<T>): Expr<T>
    ifNull<T extends Common>(...args: (T | Expr<T>)[]): Expr<T>

    // arithmetic
    add(...args: Number[]): Expr<number>
    multiply(...args: Number[]): Expr<number>
    subtract(x: Number, y: Number): Expr<number>
    divide(x: Number, y: Number): Expr<number>

    // comparison
    eq(x: Any, y: Any): Expr<boolean>
    ne(x: Any, y: Any): Expr<boolean>
    gt(x: Number, y: Number): Expr<boolean>
    gte(x: Number, y: Number): Expr<boolean>
    lt(x: Number, y: Number): Expr<boolean>
    lte(x: Number, y: Number): Expr<boolean>

    // string
    concat(...args: String[]): Expr<string>

    // logical
    and(...args: Boolean[]): Expr<boolean>
    or(...args: Boolean[]): Expr<boolean>
    not(value: Boolean): Expr<boolean>

    // aggregation
    sum(value: Number): Expr<number>
    avg(value: Number): Expr<number>
    max(value: Number): Expr<number>
    min(value: Number): Expr<number>
    count(value: Any): Expr<number>
  }
}

export const Eval = ((key, value) => ({ [kExpr]: true, ['$' + key]: value })) as Eval.Static

const operators = {} as Record<keyof Eval.Static, (args: any, data: any) => any>

operators['$'] = getRecursive

type UnaryCallback<T> = T extends (value: infer R) => Eval.Expr<infer S> ? (value: R, data: any[]) => S : never
function unary<K extends keyof Eval.Static>(key: K, callback: UnaryCallback<Eval.Static[K]>): Eval.Static[K] {
  operators['$' + key] = callback
  return (value: any) => Eval(key, value)
}

type MultaryCallback<T> = T extends (...args: infer R) => Eval.Expr<infer S> ? (args: R, data: any) => S : never
function multary<K extends keyof Eval.Static>(key: K, callback: MultaryCallback<Eval.Static[K]>): Eval.Static[K] {
  operators['$' + key] = callback
  return (...args: any) => Eval(key, args)
}

// univeral
Eval.if = multary('if', ([cond, vThen, vElse], data) => executeEval(data, cond) ? executeEval(data, vThen) : executeEval(data, vElse))
Eval.ifNull = multary('ifNull', ([value, fallback], data) => executeEval(data, value) ?? executeEval(data, fallback))

// arithmetic
Eval.add = multary('add', (args, data) => args.reduce<number>((prev, curr) => prev + executeEval(data, curr), 0))
Eval.multiply = multary('multiply', (args, data) => args.reduce<number>((prev, curr) => prev * executeEval(data, curr), 1))
Eval.subtract = multary('subtract', ([left, right], data) => executeEval(data, left) - executeEval(data, right))
Eval.divide = multary('divide', ([left, right], data) => executeEval(data, left) / executeEval(data, right))

// comparison
Eval.eq = multary('eq', ([left, right], data) => executeEval(data, left).valueOf() === executeEval(data, right).valueOf())
Eval.ne = multary('ne', ([left, right], data) => executeEval(data, left).valueOf() !== executeEval(data, right).valueOf())
Eval.gt = multary('gt', ([left, right], data) => executeEval(data, left).valueOf() > executeEval(data, right).valueOf())
Eval.gte = multary('gte', ([left, right], data) => executeEval(data, left).valueOf() >= executeEval(data, right).valueOf())
Eval.lt = multary('lt', ([left, right], data) => executeEval(data, left).valueOf() < executeEval(data, right).valueOf())
Eval.lte = multary('lte', ([left, right], data) => executeEval(data, left).valueOf() <= executeEval(data, right).valueOf())

// string
Eval.concat = multary('concat', (args, data) => args.map(arg => executeEval(data, arg)).join(''))

// logical
Eval.and = multary('and', (args, data) => args.every(arg => executeEval(data, arg)))
Eval.or = multary('or', (args, data) => args.some(arg => executeEval(data, arg)))
Eval.not = unary('not', (value, data) => !executeEval(data, value))

// aggregation
Eval.sum = unary('sum', (expr, table) => table.reduce<number>((prev, curr) => prev + executeAggr(expr, curr), 0))
Eval.avg = unary('avg', (expr, table) => table.reduce((prev, curr) => prev + executeAggr(expr, curr), 0) / table.length)
Eval.max = unary('max', (expr, table) => Math.max(...table.map(data => executeAggr(expr, data))))
Eval.min = unary('min', (expr, table) => Math.min(...table.map(data => executeAggr(expr, data))))
Eval.count = unary('count', (expr, table) => new Set(table.map(data => executeAggr(expr, data))).size)

export { Eval as $ }

type MapUneval<S> = {
  [K in keyof S]?: Uneval<S[K]>
}

export type Update<T = any> = MapUneval<Flatten<T>>

function getRecursive(args: string | string[], data: any) {
  if (typeof args === 'string') {
    // for backwards compatibility, TODO remove in v5
    return getRecursive(['_', args], data)
  }

  const [ref, path] = args
  let value = data[ref]
  for (const key of path.split('.')) {
    if (!value) return
    value = value[key]
  }
  return value
}

function executeEvalExpr(expr: any, data: any) {
  for (const key in expr) {
    if (key in operators) {
      return operators[key](expr[key], data)
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

export function executeUpdate(data: any, update: any, ref: string) {
  for (const key in update) {
    let root = data
    const path = key.split('.')
    const last = path.pop()
    for (const key of path) {
      root = root[key] ||= {}
    }
    root[last] = executeEval({ [ref]: data, _: data }, update[key])
  }
  return data
}
