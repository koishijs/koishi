import { Query, Eval } from 'koishi'
import { escape, escapeId } from 'sqlstring'

function createMemberQuery(key: string, value: any[], notStr = '') {
  if (!value.length) return notStr ? '1' : '0'
  return `${key}${notStr} IN (${value.map(val => escape(val)).join(', ')})`
}

function createRegExpQuery(key: string, value: RegExp) {
  return `${key} REGEXP ${escape(value.source)}`
}

function createElementQuery(key: string, value: any) {
  return `FIND_IN_SET(${escape(value)}, ${key})`
}

function comparator(operator: string) {
  return function (key: string, value: any) {
    return `${key} ${operator} ${escape(value)}`
  }
}

const createEqualQuery = comparator('=')

type QueryOperators = {
  [K in keyof Query.FieldExpr]?: (key: string, value: Query.FieldExpr[K]) => string
}

const queryOperators: QueryOperators = {
  // logical
  $or: (key, value) => logicalOr(value.map(value => parseFieldQuery(key, value))),
  $and: (key, value) => logicalAnd(value.map(value => parseFieldQuery(key, value))),
  $not: (key, value) => logicalNot(parseFieldQuery(key, value)),

  // comparison
  $eq: createEqualQuery,
  $ne: comparator('!='),
  $gt: comparator('>'),
  $gte: comparator('>='),
  $lt: comparator('<'),
  $lte: comparator('<='),

  // membership
  $in: (key, value) => createMemberQuery(key, value, ''),
  $nin: (key, value) => createMemberQuery(key, value, ' NOT'),

  // regexp
  $regex: createRegExpQuery,
  $regexFor: (key, value) => `${escape(value)} REGEXP ${key}`,

  // bitwise
  $bitsAllSet: (key, value) => `${key} & ${escape(value)} = ${escape(value)}`,
  $bitsAllClear: (key, value) => `${key} & ${escape(value)} = 0`,
  $bitsAnySet: (key, value) => `${key} & ${escape(value)} != 0`,
  $bitsAnyClear: (key, value) => `${key} & ${escape(value)} != ${escape(value)}`,

  // list
  $el: (key, value) => {
    if (Array.isArray(value)) {
      return `(${value.map(value => createElementQuery(key, value)).join(' || ')})`
    } else if (typeof value !== 'number' && typeof value !== 'string') {
      throw new TypeError('query expr under $el is not supported')
    } else {
      return createElementQuery(key, value)
    }
  },
  $size: (key, value) => {
    if (!value) return `!${key}`
    return `${key} && LENGTH(${key}) - LENGTH(REPLACE(${key}, ",", "")) = ${escape(value)} - 1`
  },
}

type EvaluationOperators = {
  [K in keyof Eval.GeneralExpr]?: (expr: Eval.GeneralExpr[K]) => string
}

function binary(operator: string) {
  return function ([left, right]: [Eval.Any, Eval.Any]) {
    return `(${parseEval(left)} ${operator} ${parseEval(right)})`
  }
}

const evalOperators: EvaluationOperators = {
  // numeric
  $add: (args) => `(${args.map(parseEval).join(' + ')})`,
  $multiply: (args) => `(${args.map(parseEval).join(' * ')})`,
  $subtract: binary('-'),
  $divide: binary('/'),

  // boolean
  $eq: binary('='),
  $ne: binary('!='),
  $gt: binary('>'),
  $gte: binary('>='),
  $lt: binary('<'),
  $lte: binary('<='),

  // aggregation
  $sum: (expr) => `ifnull(sum(${parseEval(expr)}), 0)`,
  $avg: (expr) => `avg(${parseEval(expr)})`,
  $min: (expr) => `$min(${parseEval(expr)})`,
  $max: (expr) => `max(${parseEval(expr)})`,
  $count: (expr) => `count(distinct ${parseEval(expr)})`,
}

function logicalAnd(conditions: string[]) {
  if (!conditions.length) return '1'
  if (conditions.includes('0')) return '0'
  return conditions.join(' && ')
}

function logicalOr(conditions: string[]) {
  if (!conditions.length) return '0'
  if (conditions.includes('1')) return '1'
  return `(${conditions.join(' || ')})`
}

function logicalNot(condition: string) {
  return `!(${condition})`
}

function parseFieldQuery(key: string, query: Query.FieldExpr) {
  const conditions: string[] = []

  // query shorthand
  if (Array.isArray(query)) {
    conditions.push(createMemberQuery(key, query))
  } else if (query instanceof RegExp) {
    conditions.push(createRegExpQuery(key, query))
  } else if (typeof query === 'string' || typeof query === 'number' || query instanceof Date) {
    conditions.push(createEqualQuery(key, query))
  } else {
    // query expression
    for (const prop in query) {
      if (prop in queryOperators) {
        conditions.push(queryOperators[prop](key, query[prop]))
      }
    }
  }

  return logicalAnd(conditions)
}

export function parseQuery(query: Query.Expr) {
  const conditions: string[] = []
  for (const key in query) {
    // logical expression
    if (key === '$not') {
      conditions.push(logicalNot(parseQuery(query.$not)))
    } else if (key === '$and') {
      conditions.push(logicalAnd(query.$and.map(parseQuery)))
    } else if (key === '$or') {
      conditions.push(logicalOr(query.$or.map(parseQuery)))
    } else if (key === '$expr') {
      conditions.push(parseEval(query.$expr))
    } else {
      conditions.push(parseFieldQuery(escapeId(key), query[key]))
    }
  }

  return logicalAnd(conditions)
}

export function parseEval(expr: Eval.Any | Eval.Aggregation): string {
  if (typeof expr === 'string') {
    return escapeId(expr)
  } else if (typeof expr === 'number' || typeof expr === 'boolean') {
    return escape(expr)
  }

  for (const key in expr) {
    if (key in evalOperators) {
      return evalOperators[key](expr[key])
    }
  }
}
