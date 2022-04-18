import { defineProperty, Dict, pick, valueMap } from '@koishijs/utils'
import { Driver } from './driver'
import { Eval, executeEval } from './eval'
import { Model } from './model'
import { Query } from './query'
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

  export type Type = 'get' | 'set' | 'remove' | 'create' | 'upsert' | 'eval'

  export interface Payload {
    type: Type
    ref: string
    name: string
    query: Query.Expr
    fields?: Dict<Eval.Expr>
    expr?: Eval.Expr
    args?: any[]
  }
}

const createRow = (ref: string, prefix = '', expr = {}) => new Proxy(expr, {
  get(target, key) {
    if (typeof key === 'symbol' || key.startsWith('$')) return Reflect.get(target, key)
    return createRow(ref, `${prefix}${key}.`, Eval('', [ref, `${prefix}${key}`]))
  },
})

export interface Executable extends Selection.Payload {}

export class Executable<S = any, T = any> {
  #row: Selection.Row<S>
  #model: Model

  protected driver: Driver

  constructor(driver: Driver, payload?: Selection.Payload) {
    defineProperty(this, 'driver', driver)
    Object.assign(this, payload)
  }

  get row() {
    return this.#row ||= createRow(this.name)
  }

  get model() {
    return this.#model ||= this.driver.model(this.ref)
  }

  protected resolveQuery(query: Query<S>): Query.Expr<S>
  protected resolveQuery(query: Query<S> = {}): any {
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

  execute(): Promise<T> {
    return this.driver.execute(this)
  }
}

const letters = 'abcdefghijklmnopqrstuvwxyz'

export class Selection<S = any> extends Executable<S, S[]> {
  type: Selection.Type = 'get'
  args: [Modifier]

  constructor(driver: Driver, table: string, query: Query) {
    super(driver)
    this.name = Array(8).fill(0).map(() => letters[Math.floor(Math.random() * letters.length)]).join('')
    this.ref = table
    this.query = this.resolveQuery(query)
    this.args = [{ sort: [], limit: Infinity, offset: 0 }]
  }

  limit(limit: number) {
    this.args[0].limit = limit
    return this
  }

  offset(offset: number) {
    this.args[0].offset = offset
    return this
  }

  orderBy(field: Selection.Field<S>, direction?: Direction) {
    this.args[0].sort.push([this.resolveField(field), direction])
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

  evaluate<T>(callback: Selection.Callback<S, T>): Executable<S, T> {
    return new Executable(this.driver, {
      ...this,
      type: 'eval',
      args: [this.resolveField(callback)],
    })
  }
}

export function executeSort(data: any[], modifier: Modifier, name: string) {
  const { limit, offset, sort } = modifier

  // step 1: sort data
  data.sort((a, b) => {
    for (const [field, direction] of sort) {
      const sign = direction === 'asc' ? 1 : -1
      const x = executeEval({ [name]: a, _: a }, field)
      const y = executeEval({ [name]: b, _: b }, field)
      if (x < y) return -sign
      if (x > y) return sign
    }
    return 0
  })

  // step 2: truncate data
  return data.slice(offset, offset + limit)
}
