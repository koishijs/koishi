import { Query, Eval } from 'koishi'
import { escape, escapeId } from 'sqlstring'

export * from 'sqlstring'

type QueryOperators = {
  [K in keyof Query.FieldExpr]?: (this: Factory, key: string, value: Query.FieldExpr[K]) => string
}

type EvaluationOperators = {
  [K in keyof Eval.GeneralExpr]?: (this: Factory, expr: Eval.GeneralExpr[K]) => string
}

export default class Factory {
  escape = escape
  escapeId = escapeId

  protected query: QueryOperators & this
  protected eval: EvaluationOperators & this

  constructor() {
    this.query = Object.assign(Object.create(this), queryOperators)
    this.eval = Object.assign(Object.create(this), evalOperators)
  }

  createElementQuery = (key: string, value: any) => {
    return `FIND_IN_SET(${this.escape(value)}, ${key})`
  }

  parseFieldQuery = (key: string, query: Query.FieldExpr) => {
    const conditions: string[] = []

    // query shorthand
    if (Array.isArray(query)) {
      conditions.push(this.query.$in(key, query))
    } else if (query instanceof RegExp) {
      conditions.push(this.query.$regex(key, query))
    } else if (typeof query === 'string' || typeof query === 'number' || query instanceof Date) {
      conditions.push(this.query.$eq(key, query))
    } else {
      // query expression
      for (const prop in query) {
        if (this.query.hasOwnProperty(prop)) {
          conditions.push(this.query[prop](key, query[prop]))
        }
      }
    }

    return logicalAnd(conditions)
  }

  parseQuery = (query: Query.Expr) => {
    const conditions: string[] = []
    for (const key in query) {
      // logical expression
      if (key === '$not') {
        conditions.push(logicalNot(this.parseQuery(query.$not)))
      } else if (key === '$and') {
        conditions.push(logicalAnd(query.$and.map(this.parseQuery)))
      } else if (key === '$or') {
        conditions.push(logicalOr(query.$or.map(this.parseQuery)))
      } else if (key === '$expr') {
        conditions.push(this.parseEval(query.$expr))
      } else {
        conditions.push(this.parseFieldQuery(this.escapeId(key), query[key]))
      }
    }

    return logicalAnd(conditions)
  }

  parseEval = (expr: Eval.Any | Eval.Aggregation): string => {
    if (typeof expr === 'string') {
      return this.escapeId(expr)
    } else if (typeof expr === 'number' || typeof expr === 'boolean') {
      return this.escape(expr)
    }
  
    for (const key in expr) {
      if (this.eval.hasOwnProperty(key)) {
        return this.eval[key](expr[key])
      }
    }
  }
}

function comparator(operator: string) {
  return function (this: Factory, key: string, value: any) {
    return `${key} ${operator} ${this.escape(value)}`
  }
}

const createEqualQuery = comparator('=')

function membership(infix: string) {
  return function (this: Factory, key: string, value: any[]) {
    if (!value.length) return infix ? '1' : '0'
    return `${key}${infix} IN (${value.map(val => this.escape(val)).join(', ')})`
  }
}

const createMemberQuery = membership('')

function createRegExpQuery(this: Factory, key: string, value: RegExp) {
  return `${key} REGEXP ${this.escape(value.source)}`
}

const queryOperators: QueryOperators = {
  // logical
  $or(key, value) {
    return logicalOr(value.map(value => this.parseFieldQuery(key, value)))
  },
  $and(key, value) {
    return logicalAnd(value.map(value => this.parseFieldQuery(key, value)))
  },
  $not(key, value) {
    return logicalNot(this.parseFieldQuery(key, value))
  },

  // comparison
  $eq: createEqualQuery,
  $ne: comparator('!='),
  $gt: comparator('>'),
  $gte: comparator('>='),
  $lt: comparator('<'),
  $lte: comparator('<='),

  // membership
  $in: createMemberQuery,
  $nin: membership(' NOT'),

  // regexp
  $regex: createRegExpQuery,
  $regexFor: (key, value) => `${escape(value)} REGEXP ${key}`,

  // bitwise
  $bitsAllSet: (key, value) => `${key} & ${escape(value)} = ${escape(value)}`,
  $bitsAllClear: (key, value) => `${key} & ${escape(value)} = 0`,
  $bitsAnySet: (key, value) => `${key} & ${escape(value)} != 0`,
  $bitsAnyClear: (key, value) => `${key} & ${escape(value)} != ${escape(value)}`,

  // list
  $el(key, value) {
    if (Array.isArray(value)) {
      return logicalOr(value.map(value => this.createElementQuery(key, value)))
    } else if (typeof value !== 'number' && typeof value !== 'string') {
      throw new TypeError('query expr under $el is not supported')
    } else {
      return this.createElementQuery(key, value)
    }
  },
  $size(key, value) {
    if (!value) return logicalNot(key)
    return `${key} AND LENGTH(${key}) - LENGTH(REPLACE(${key}, ",", "")) = ${escape(value)} - 1`
  },
}

function evalBinary(operator: string) {
  return function (this: Factory, [left, right]: [Eval.Any, Eval.Any]) {
    return `(${this.parseEval(left)} ${operator} ${this.parseEval(right)})`
  }
}

function evalUnary(wrapper: (expr: string) => string) {
  return function (this: Factory, expr: Eval.Any) {
    return wrapper(this.parseEval(expr))
  }
}

function evalList(wrapper: (args: string[]) => string) {
  return function (this: Factory, args: Eval.Any[]) {
    return wrapper(args.map(this.parseEval))
  }
}

const evalOperators: EvaluationOperators = {
  // numeric
  $add: evalList(args => `(${args.join(' + ')})`),
  $multiply: evalList(args => `(${args.join(' * ')})`),
  $subtract: evalBinary('-'),
  $divide: evalBinary('/'),

  // boolean
  $eq: evalBinary('='),
  $ne: evalBinary('!='),
  $gt: evalBinary('>'),
  $gte: evalBinary('>='),
  $lt: evalBinary('<'),
  $lte: evalBinary('<='),

  // aggregation
  $sum: evalUnary(expr => `ifnull(sum(${expr}), 0)`),
  $avg: evalUnary(expr => `avg(${expr})`),
  $min: evalUnary(expr => `min(${expr})`),
  $max: evalUnary(expr => `max(${expr})`),
  $count: evalUnary(expr => `count(distinct ${expr})`),
}

function logicalAnd(conditions: string[]) {
  if (!conditions.length) return '1'
  if (conditions.includes('0')) return '0'
  return conditions.join(' AND ')
}

function logicalOr(conditions: string[]) {
  if (!conditions.length) return '0'
  if (conditions.includes('1')) return '1'
  return `(${conditions.join(' OR ')})`
}

function logicalNot(condition: string) {
  return `NOT (${condition})`
}
