import { Query, Eval, Dict, Model } from 'koishi'

export type QueryOperators = {
  [K in keyof Query.FieldExpr]?: (key: string, value: Query.FieldExpr[K]) => string
}

export type EvalOperators = {
  [K in keyof Eval.GeneralExpr]?: (expr: Eval.GeneralExpr[K]) => string
}

export abstract class Builder {
  protected createEqualQuery = this.comparator('=')
  protected queryOperators: QueryOperators
  protected evalOperators: EvalOperators

  abstract escapeId(value: any): string
  abstract escape(value: any, table?: string, field?: string): string
  abstract format(sql: string, args?: object | any[]): string

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
      // universal
      $: (key) => this.getRecursive(key),
      $if: (args) => `IF(${args.map(arg => this.parseEval(arg)).join(', ')})`,
      $ifNull: (args) => `IFNULL(${args.map(arg => this.parseEval(arg)).join(', ')})`,

      // number
      $add: (args) => `(${args.map(arg => this.parseEval(arg)).join(' + ')})`,
      $multiply: (args) => `(${args.map(arg => this.parseEval(arg)).join(' * ')})`,
      $subtract: this.binary('-'),
      $divide: this.binary('/'),

      // string
      $concat: (args) => `concat(${args.map(arg => this.parseEval(arg)).join(', ')})`,

      // boolean
      $eq: this.binary('='),
      $ne: this.binary('!='),
      $gt: this.binary('>'),
      $gte: this.binary('>='),
      $lt: this.binary('<'),
      $lte: this.binary('<='),

      // aggregation
      $sum: (expr) => `ifnull(sum(${this.parseAggr(expr)}), 0)`,
      $avg: (expr) => `avg(${this.parseAggr(expr)})`,
      $min: (expr) => `min(${this.parseAggr(expr)})`,
      $max: (expr) => `max(${this.parseAggr(expr)})`,
      $count: (expr) => `count(distinct ${this.parseAggr(expr)})`,
    }
  }

  protected createMemberQuery(key: string, value: any[], notStr = '') {
    if (!value.length) return notStr ? '1' : '0'
    return `${key}${notStr} in (${value.map(val => this.escape(val)).join(', ')})`
  }

  protected createRegExpQuery(key: string, value: RegExp) {
    return `${key} regexp ${this.escape(value.source)}`
  }

  protected createElementQuery(key: string, value: any) {
    return `find_in_set(${this.escape(value)}, ${key})`
  }

  protected comparator(operator: string) {
    return function (key: string, value: any) {
      return `${key} ${operator} ${this.escape(value)}`
    }.bind(this)
  }

  protected binary(operator: string) {
    return function ([left, right]) {
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

  private parseEvalExpr(expr: any, table?: string, field?: string) {
    for (const key in expr) {
      if (key in this.evalOperators) {
        return this.evalOperators[key](expr[key])
      }
    }
    return this.escape(expr, table, field)
  }

  private parseAggr(expr: any) {
    if (typeof expr === 'string') {
      return this.getRecursive(expr)
    }
    return this.parseEvalExpr(expr)
  }

  private getRecursive(key: string) {
    if (!key.includes('.')) return this.escapeId(key)
    const [field, ...rest] = key.split('.')
    return `json_unquote(json_extract(${this.escapeId(field)}, '$${rest.map(key => `."${key}"`).join('')}'))`
  }

  parseEval(expr: any, table?: string, field?: string): string {
    if (typeof expr === 'string' || typeof expr === 'number' || typeof expr === 'boolean' || expr instanceof Date) {
      return this.escape(expr, table, field)
    }
    return this.parseEvalExpr(expr, table, field)
  }
}

export interface TypeCaster<S = any, T = any> {
  types: Model.Field.Type<S>[]
  dump: (value: S) => T
  load: (value: T, initial?: S) => S
}

export class Caster {
  protected types: Dict<TypeCaster>

  constructor(private model: Model) {
    this.types = Object.create(null)
  }

  register<S, T>(typeCaster: TypeCaster<S, T>) {
    typeCaster.types.forEach(type => this.types[type] = typeCaster)
  }

  dump(table: string, obj: any): any {
    const { fields } = this.model.config[table]
    const result = {}
    for (const key in obj) {
      const converter = this.types[fields[key]?.type]
      result[key] = converter ? converter.dump(obj[key]) : obj[key]
    }
    return result
  }

  load(table: string, obj: any): any {
    const { fields } = this.model.config[table]
    const result = {}
    for (const key in obj) {
      const { type, initial } = fields[key]
      const converter = this.types[type]
      result[key] = converter ? converter.load(obj[key], initial) : obj[key]
    }
    return result
  }
}
