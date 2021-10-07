import { Query, Eval } from 'koishi'

export type QueryOperators = {
  [K in keyof Query.FieldExpr]?: (key: string, value: Query.FieldExpr[K]) => string
}

export type EvaluationOperators = {
  [K in keyof Eval.GeneralExpr]?: (expr: Eval.GeneralExpr[K]) => string
}

export default abstract class Factory {
  protected createEqualQuery = this.comparator('=')
  protected queryOperators: QueryOperators
  protected evalOperators: EvaluationOperators

  constructor() {
    this.queryOperators = {
      // logical
      $or: (key, value) => this.logicalOr(value.map(value => this.parseFieldQuery(key, value))),
      $and: (key, value) => this.logicalAnd(value.map(value => this.parseFieldQuery(key, value))),
      $not: (key, value) => this.logicalNot(this.parseFieldQuery(key, value)),

      // comparison
      $eq: this.createEqualQuery,
      $ne: this.comparator('!='),
      $gt: this.comparator('>'),
      $gte: this.comparator('>='),
      $lt: this.comparator('<'),
      $lte: this.comparator('<='),

      // membership
      $in: (key, value) => this.createMemberQuery(key, value, ''),
      $nin: (key, value) => this.createMemberQuery(key, value, ' NOT'),

      // regexp
      $regex: (key: string, value: RegExp) => this.createRegExpQuery(key, value),
      $regexFor: (key, value) => `${this.escape(value)} REGEXP ${key}`,

      // bitwise
      $bitsAllSet: (key, value) => `${key} & ${this.escape(value)} = ${this.escape(value)}`,
      $bitsAllClear: (key, value) => `${key} & ${this.escape(value)} = 0`,
      $bitsAnySet: (key, value) => `${key} & ${this.escape(value)} != 0`,
      $bitsAnyClear: (key, value) => `${key} & ${this.escape(value)} != ${this.escape(value)}`,

      // list
      $el: (key, value) => {
        if (Array.isArray(value)) {
          return this.logicalOr(value.map(value => this.createElementQuery(key, value)))
        } else if (typeof value !== 'number' && typeof value !== 'string') {
          throw new TypeError('query expr under $el is not supported')
        } else {
          return this.createElementQuery(key, value)
        }
      },
      $size: (key, value) => {
        if (!value) return this.logicalNot(key)
        return `${key} AND LENGTH(${key}) - LENGTH(REPLACE(${key}, ${this.escape(',')}, ${this.escape('')})) = ${this.escape(value)} - 1`
      },
    }

    this.evalOperators = {
      // numeric
      $add: (args) => `(${args.map(this.parseEval.bind(this)).join(' + ')})`,
      $multiply: (args) => `(${args.map(this.parseEval.bind(this)).join(' * ')})`,
      $subtract: this.binary('-'),
      $divide: this.binary('/'),

      // boolean
      $eq: this.binary('='),
      $ne: this.binary('!='),
      $gt: this.binary('>'),
      $gte: this.binary('>='),
      $lt: this.binary('<'),
      $lte: this.binary('<='),

      // aggregation
      $sum: (expr) => `ifnull(sum(${this.parseEval(expr)}), 0)`,
      $avg: (expr) => `avg(${this.parseEval(expr)})`,
      $min: (expr) => `$min(${this.parseEval(expr)})`,
      $max: (expr) => `max(${this.parseEval(expr)})`,
      $count: (expr) => `count(distinct ${this.parseEval(expr)})`,
    }
  }

  abstract escapeId(value: any, forbidQualified?: boolean): string
  abstract escape(value: any, stringifyObjects?: boolean, timeZone?: string): string

  protected createMemberQuery(key: string, value: any[], notStr = '') {
    if (!value.length) return notStr ? '1' : '0'
    return `${key}${notStr} IN (${value.map(val => this.escape(val)).join(', ')})`
  }

  protected createRegExpQuery(key: string, value: RegExp) {
    return `${key} REGEXP ${this.escape(value.source)}`
  }

  protected createElementQuery(key: string, value: any) {
    return `FIND_IN_SET(${this.escape(value)}, ${key})`
  }

  protected comparator(operator: string) {
    return function (key: string, value: any) {
      return `${key} ${operator} ${this.escape(value)}`
    }.bind(this)
  }

  protected binary(operator: string) {
    return function ([left, right]: [Eval.Any, Eval.Any]) {
      return `(${this.parseEval(left)} ${operator} ${this.parseEval(right)})`
    }.bind(this)
  }

  protected logicalAnd(conditions: string[]) {
    if (!conditions.length) return '1'
    if (conditions.includes('0')) return '0'
    return conditions.join(' AND ')
  }

  protected logicalOr(conditions: string[]) {
    if (!conditions.length) return '0'
    if (conditions.includes('1')) return '1'
    return `(${conditions.join(' OR ')})`
  }

  protected logicalNot(condition: string) {
    return `NOT(${condition})`
  }

  protected parseFieldQuery(key: string, query: Query.FieldExpr) {
    const conditions: string[] = []

    // query shorthand
    if (Array.isArray(query)) {
      conditions.push(this.createMemberQuery(key, query))
    } else if (query instanceof RegExp) {
      conditions.push(this.createRegExpQuery(key, query))
    } else if (typeof query === 'string' || typeof query === 'number' || query instanceof Date) {
      conditions.push(this.createEqualQuery(key, query))
    } else {
    // query expression
      for (const prop in query) {
        if (prop in this.queryOperators) {
          conditions.push(this.queryOperators[prop](key, query[prop]))
        }
      }
    }

    return this.logicalAnd(conditions)
  }

  parseQuery(query: Query.Expr) {
    const conditions: string[] = []
    for (const key in query) {
    // logical expression
      if (key === '$not') {
        conditions.push(this.logicalNot(this.parseQuery(query.$not)))
      } else if (key === '$and') {
        conditions.push(this.logicalAnd(query.$and.map(this.parseQuery.bind(this))))
      } else if (key === '$or') {
        conditions.push(this.logicalOr(query.$or.map(this.parseQuery.bind(this))))
      } else if (key === '$expr') {
        conditions.push(this.parseEval(query.$expr))
      } else {
        conditions.push(this.parseFieldQuery(this.escapeId(key), query[key]))
      }
    }

    return this.logicalAnd(conditions)
  }

  parseEval(expr: Eval.Any | Eval.Aggregation): string {
    if (typeof expr === 'string') {
      return this.escapeId(expr)
    } else if (typeof expr === 'number' || typeof expr === 'boolean') {
      return this.escape(expr)
    }

    for (const key in expr) {
      if (key in this.evalOperators) {
        return this.evalOperators[key](expr[key])
      }
    }
  }
}
