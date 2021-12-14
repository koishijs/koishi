import { Query, Eval } from 'koishi'

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

  // number
  $add: (args, data) => args.reduce<number>((prev, curr) => prev + executeEval(curr, data), 0),
  $multiply: (args, data) => args.reduce<number>((prev, curr) => prev * executeEval(curr, data), 1),
  $subtract: ([left, right], data) => executeEval(left, data) - executeEval(right, data),
  $divide: ([left, right], data) => executeEval(left, data) - executeEval(right, data),

  // string
  $concat: (args, data) => args.map(arg => executeEval(arg, data)).join(''),

  // boolean
  $eq: ([left, right], data) => executeEval(left, data).valueOf() === executeEval(right, data).valueOf(),
  $ne: ([left, right], data) => executeEval(left, data).valueOf() !== executeEval(right, data).valueOf(),
  $gt: ([left, right], data) => executeEval(left, data).valueOf() > executeEval(right, data).valueOf(),
  $gte: ([left, right], data) => executeEval(left, data).valueOf() >= executeEval(right, data).valueOf(),
  $lt: ([left, right], data) => executeEval(left, data).valueOf() < executeEval(right, data).valueOf(),
  $lte: ([left, right], data) => executeEval(left, data).valueOf() <= executeEval(right, data).valueOf(),

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

export function executeQuery(query: Query.Expr, data: any): boolean {
  const entries: [string, any][] = Object.entries(query)
  return entries.every(([key, value]) => {
    // execute logical query
    if (key === '$and') {
      return (value as Query.Expr[]).reduce((prev, query) => prev && executeQuery(query, data), true)
    } else if (key === '$or') {
      return (value as Query.Expr[]).reduce((prev, query) => prev || executeQuery(query, data), false)
    } else if (key === '$not') {
      return !executeQuery(value, data)
    } else if (key === '$expr') {
      return executeEval(value, data)
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

function executeEval(expr: any, data: any) {
  if (typeof expr === 'number' || typeof expr === 'string' || typeof expr === 'boolean') {
    return expr
  }
  return executeEvalExpr(expr, data)
}

export function mapEvaluate(update: any, data: any) {
  const result = {}
  for (const key in update) {
    let root = result
    const path = key.split('.')
    const last = path.pop()
    for (const key of path) {
      root = root[key] ||= {}
    }
    root[last] = executeEval(update[key], data)
  }
  return result
}
