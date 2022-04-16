import { defineProperty, Dict, makeArray, pick, valueMap } from '@koishijs/utils'
import { Driver } from './driver'
import { Eval, executeEval, executeUpdate } from './eval'
import { Model } from './model'
import { executeQuery, Query } from './query'
import { Common, Keys } from './utils'

export type Direction = 'asc' | 'desc'

export interface Modifier {
  limit: number
  offset: number
  sort: [Eval.Expr, Direction][]
}

export type Selector<S> = Keys<S>// | Selection

export namespace Selector {
  export type Resolve<S, T> =
    | T extends Keys<S> ? S[T]
    // : T extends Selection<infer U> ? U
    : never
}

export namespace Selection {
  export type Callback<S, T = any> = (row: Row<S>) => Eval.Expr<T>
  export type Field<S = any> = Keys<S> | Callback<S>
  export type Resolve<S, F extends Field<S>> =
    | F extends Keys<S> ? S[F]
    : F extends Callback<S> ? Eval<ReturnType<F>>
    : never

  export type Row<S> = {
    [K in keyof S]: Eval.Expr<S[K]> & (S[K] extends Common ? {} : Row<S[K]>)
  }

  export type Yield<S, T> = T | ((row: Row<S>) => T)

  export type Project<S, T extends Dict<Field<S>>> = {
    [K in keyof T]: Resolve<S, T[K]>
  }

  export interface Payload {
    ref: string
    table: string
    modifier: Modifier
    fields?: Dict<Eval.Expr>
    query?: Query.Expr
    expr?: Eval.Expr
  }
}

const createRow = (ref: string, prefix = '', expr = {}) => new Proxy(expr, {
  get(target, key) {
    if (typeof key === 'symbol' || key.startsWith('$')) return Reflect.get(target, key)
    return createRow(ref, `${prefix}${key}.`, Eval('', [ref, `${prefix}${key}`]))
  },
})

export interface Executable extends Selection.Payload {}

export abstract class Executable<S = any, T = any> {
  #row: Selection.Row<S>
  #model: Model

  protected driver: Driver

  constructor(driver: Driver, payload?: Selection.Payload) {
    defineProperty(this, 'driver', driver)
    Object.assign(this, payload)
  }

  get row() {
    return this.#row ||= createRow(this.ref)
  }

  get model() {
    return this.#model ||= this.driver.model(this.table)
  }

  resolveQuery(query: Query<S>): Query.Expr<S>
  resolveQuery(query: Query<S> = {}): any {
    if (typeof query === 'function') return { $expr: query(this.row) }
    if (Array.isArray(query) || query instanceof RegExp || ['string', 'number'].includes(typeof query)) {
      const { primary } = this.model
      if (Array.isArray(primary)) {
        throw new TypeError('invalid shorthand for composite primary key')
      }
      return { [primary]: query }
    }
    return query
  }

  resolveUpdate(update: any) {
    if (typeof update === 'function') update = update(this.row)
    const { primary } = this.model
    if (makeArray(primary).some(key => key in update)) {
      throw new TypeError(`cannot modify primary key`)
    }
    return this.model.format(update)
  }

  resolveUpsert(upsert: any) {
    if (typeof upsert === 'function') upsert = upsert(this.row)
    return upsert.map(item => this.model.format(item))
  }

  resolveData(data: any, fields: Dict<Eval.Expr<any>>) {
    data = this.model.format(data)
    for (const key in this.model.fields) {
      data[key] ??= null
    }
    if (!fields) return this.model.parse(data)
    return this.model.parse(pick(data, Object.keys(fields)))
  }

  protected resolveField(field: Selection.Field<S>): Eval.Expr {
    if (typeof field === 'string') {
      return this.row[field]
    } else if (typeof field === 'function') {
      return field(this.row)
    }
  }

  filter(data: any) {
    return executeQuery(data, this.query, this.ref)
  }

  update(data: any, update: any) {
    return executeUpdate(data, update, this.ref)
  }

  truncate(data: any[]) {
    const { limit, offset, sort } = this.modifier

    // step 1: sort data
    data.sort((a, b) => {
      for (const [field, direction] of sort) {
        const sign = direction === 'asc' ? 1 : -1
        const x = executeEval({ [this.ref]: a }, field)
        const y = executeEval({ [this.ref]: b }, field)
        if (x < y) return -sign
        if (x > y) return sign
      }
      return 0
    })

    // step 2: truncate data
    return data.slice(offset, offset + limit)
  }

  execute(): Promise<T> {
    return this.driver.execute(this)
  }
}

const letters = 'abcdefghijklmnopqrstuvwxyz'

export class Selection<S = any> extends Executable<S, S[]> {
  constructor(driver: Driver, table: string, query: Query) {
    super(driver)
    this.ref = Array(8).fill(0).map(() => letters[Math.floor(Math.random() * letters.length)]).join('')
    this.table = table
    this.query = this.resolveQuery(query)
    this.modifier = { sort: [], limit: Infinity, offset: 0 }
  }

  limit(limit: number) {
    this.modifier.limit = limit
    return this
  }

  offset(offset: number) {
    this.modifier.offset = offset
    return this
  }

  orderBy(field: Selection.Field<S>, direction?: Direction) {
    this.modifier.sort.push([this.resolveField(field), direction])
    return this
  }

  project<T extends Keys<S>>(fields: T[]): Selection<Pick<S, T>>
  project<T extends Dict<Selection.Field<S>>>(fields: T): Selection<Selection.Project<S, T>>
  project(fields: Keys<S>[] | Dict<Selection.Field<S>>) {
    if (Array.isArray(fields)) {
      const modelFields = Object.keys(this.model.fields)
      const keys = fields.flatMap((key) => {
        if (this.model.fields[key]) return key
        return modelFields.filter(path => path.startsWith(key + '.'))
      })
      this.fields = Object.fromEntries(keys.map(key => [key, this.row[key]]))
    } else {
      this.fields = valueMap(fields, field => this.resolveField(field))
    }
    return this as any
  }

  evaluate<T>(callback: Selection.Callback<S, T>): Evaluation<S, T> {
    return new Evaluation(this.driver, {
      ...this,
      expr: this.resolveField(callback),
    })
  }
}

export class Evaluation<S = any, T = any> extends Executable<S, T> {}
