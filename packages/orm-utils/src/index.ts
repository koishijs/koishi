import { Query, Eval, Dict, isNullable } from 'koishi'

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

function executeEvalExpr(expr: any, data: any) {
  for (const key in expr) {
    if (key in evalOperators) {
      return evalOperators[key](expr[key], data)
    }
  }
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
