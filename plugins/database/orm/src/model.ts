import { clone, isNullable, Logger, makeArray, MaybeArray } from '@koishijs/utils'
import { isEvalExpr } from './eval'
import { Flatten, Keys } from './utils'

const logger = new Logger('model')

export interface Field<T = any> {
  type: Field.Type<T>
  length?: number
  nullable?: boolean
  initial?: T
  precision?: number
  scale?: number
}

export namespace Field {
  export const number: Type[] = ['integer', 'unsigned', 'float', 'double', 'decimal']
  export const string: Type[] = ['char', 'string', 'text']
  export const date: Type[] = ['timestamp', 'date', 'time']
  export const object: Type[] = ['list', 'json']

  export type Type<T = any> =
    | T extends number ? 'integer' | 'unsigned' | 'float' | 'double' | 'decimal'
    : T extends string ? 'char' | 'string' | 'text'
    : T extends Date ? 'timestamp' | 'date' | 'time'
    : T extends unknown[] ? 'list' | 'json'
    : T extends object ? 'json'
    : never

  type Shorthand<S extends string> = S | `${S}(${any})`

  type MapField<O = any> = {
    [K in keyof O]?: O[K] extends (...args: any) => any
      ? O[K]
      : Field<O[K]> | Shorthand<Type<O[K]>>
  }

  export type Extension<O = any> = MapField<Flatten<O>>

  export type Config<O = any> = {
    [K in keyof O]?: O[K] extends (...args: any) => any ? never : Field<O[K]>
  }

  export type Internal<O = any> = {
    [K in keyof O]?: O[K] extends (...args: any) => any ? O[K] : never
  }

  const regexp = /^(\w+)(?:\((.+)\))?$/

  export function parse(source: string | Field): Field {
    if (typeof source !== 'string') return { initial: null, ...source }

    // parse string definition
    const capture = regexp.exec(source)
    if (!capture) throw new TypeError('invalid field definition')
    const type = capture[1] as Type
    const args = (capture[2] || '').split(',')
    const field: Field = { type }

    // set default initial value
    if (field.initial === undefined) {
      if (number.includes(field.type)) field.initial = 0
      if (string.includes(field.type)) field.initial = ''
      if (field.type === 'list') field.initial = []
      if (field.type === 'json') field.initial = {}
    }

    // set length information
    if (type === 'decimal') {
      field.precision = +args[0]
      field.scale = +args[1]
    } else if (args[0]) {
      field.length = +args[0]
    }

    return field
  }
}

export namespace Model {
  export interface Config<O = {}> {
    autoInc?: boolean
    primary?: MaybeArray<Keys<O>>
    unique?: MaybeArray<Keys<O>>[]
    foreign?: {
      [K in keyof O]?: [string, string]
    }
  }
}

export interface Model<S> extends Model.Config<S> {}

export class Model<S = any> {
  fields: Field.Config<S> = {}
  internal: Field.Internal<S> = { '': {} } as never

  constructor(public name: string) {
    this.primary = 'id' as never
    this.unique = []
    this.foreign = {}
  }

  extend(fields: Field.Extension<S>, config?: Model.Config<S>): void
  extend(fields = {}, config: Model.Config = {}) {
    const { primary, autoInc, unique = [] as [], foreign } = config

    this.primary = primary || this.primary
    this.autoInc = autoInc || this.autoInc
    this.unique.push(...unique)
    Object.assign(this.foreign, foreign)

    for (const key in fields) {
      if (typeof fields[key] === 'function') {
        const index = key.lastIndexOf('.')
        const prefix = key.slice(0, index + 1)
        const method = key.slice(index + 1)
        ;(this.internal[prefix] ??= {})[method] = fields[key]
      } else {
        if (this.fields[key]) {
          logger.warn('override', this.name, key)
        }
        this.fields[key] = Field.parse(fields[key])
      }
    }

    // check index
    this.checkIndex(this.primary)
    this.unique.forEach(index => this.checkIndex(index))
  }

  private checkIndex(index: MaybeArray<string>) {
    for (const key of makeArray(index)) {
      if (!this.fields[key]) {
        throw new TypeError(`missing field definition for index key "${key}"`)
      }
    }
  }

  resolveValue(key: string, value: any) {
    if (isNullable(value)) return value
    if (this.fields[key]?.type === 'time') {
      const date = new Date(0)
      date.setHours(value.getHours(), value.getMinutes(), value.getSeconds(), value.getMilliseconds())
      return date
    }
    return value
  }

  format(source: object, prefix = '', result = {} as S) {
    const fields = Object.keys(this.fields)
    Object.entries(source).map(([key, value]) => {
      key = prefix + key
      if (fields.includes(key)) {
        result[key] = value
      } else if (!value || typeof value !== 'object' || isEvalExpr(value)) {
        const field = fields.find(field => key.startsWith(field + '.'))
        if (field) {
          result[key] = value
        } else {
          throw new TypeError(`unknown field "${key}" in model ${this.name}`)
        }
      } else {
        this.format(value, key + '.', result)
      }
    })
    return result
  }

  parse(source: object) {
    const result: any = Object.create(this.internal[''])
    for (const key in source) {
      let node = result
      const segments = key.split('.').reverse()
      let prefix = ''
      for (let index = segments.length - 1; index > 0; index--) {
        const segment = segments[index]
        prefix += segment + '.'
        node = node[segment] ??= Object.create(this.internal[prefix] ?? {})
      }
      if (key in source) {
        const value = this.resolveValue(key, source[key])
        node[segments[0]] = value
      }
    }
    return result
  }

  create(data?: {}) {
    const result = {} as S
    const keys = makeArray(this.primary)
    for (const key in this.fields) {
      if (!keys.includes(key) && !isNullable(this.fields[key].initial)) {
        result[key] = clone(this.fields[key].initial)
      }
    }
    return this.parse({ ...result, ...data })
  }
}
