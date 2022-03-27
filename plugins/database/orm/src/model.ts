import { clone, Dict, isNullable, makeArray, MaybeArray } from '@koishijs/utils'
import { isEvalExpr } from './eval'
import { ModelError } from './error'
import { Flatten, Keys } from './utils'

export class Model<T = any> {
  public config: Dict<Model.Config> = {}

  extend<K extends Keys<T>>(name: K, fields?: Model.Field.Extension<T[K]>, extension?: Model.Extension<T[K]>): void
  extend(name: Keys<T>, fields = {}, extension: Model.Extension = {}) {
    const { primary, autoInc, unique = [], foreign } = extension
    const table = this.config[name] ||= {
      primary: 'id',
      unique: [],
      foreign: {},
      fields: {},
      internal: { '': {} },
    }

    table.primary = primary || table.primary
    table.autoInc = autoInc || table.autoInc
    table.unique.push(...unique)
    Object.assign(table.foreign, foreign)

    for (const key in fields) {
      if (typeof fields[key] === 'function') {
        const index = key.lastIndexOf('.')
        const prefix = key.slice(0, index + 1)
        const method = key.slice(index + 1)
        ;(table.internal[prefix] ??= {})[method] = fields[key]
      } else {
        table.fields[key] = Model.Field.parse(fields[key])
      }
    }

    // check index
    this.checkIndex(table, table.primary)
    table.unique.forEach(index => this.checkIndex(table, index))
  }

  private checkIndex(table: Model.Config, index: MaybeArray<string>) {
    for (const key of makeArray(index)) {
      if (!table.fields[key]) {
        throw new ModelError(`missing field definition for index key "${key}"`)
      }
    }
  }

  create<K extends Keys<T>>(name: K, data?: {}) {
    const { fields, primary } = this.config[name]
    const result = {}
    const keys = makeArray(primary)
    for (const key in fields) {
      if (!keys.includes(key) && !isNullable(fields[key].initial)) {
        result[key] = clone(fields[key].initial)
      }
    }
    return this.parse(name, { ...result, ...data }) as T[K]
  }

  resolveValue(name: string, key: string, value: any) {
    if (isNullable(value)) return value
    const { fields } = this.config[name]
    if (fields[key]?.type === 'time') {
      const date = new Date(0)
      date.setHours(value.getHours(), value.getMinutes(), value.getSeconds(), value.getMilliseconds())
      return date
    }
    return value
  }

  parse<K extends Keys<T>>(name: K, source: object) {
    const { internal } = this.config[name]
    const result: any = Object.create(internal[''])
    for (const key in source) {
      let node = result
      const segments = key.split('.').reverse()
      let prefix = ''
      for (let index = segments.length - 1; index > 0; index--) {
        const segment = segments[index]
        prefix += segment + '.'
        node = node[segment] ??= Object.create(internal[prefix] ?? {})
      }
      if (key in source) {
        const value = this.resolveValue(name, key, source[key])
        node[segments[0]] = value
      }
    }
    return result
  }

  format<K extends Keys<T>>(name: K, source: object, prefix = '', result = {} as T[K]) {
    const fields = Object.keys(this.config[name].fields)
    Object.entries(source).map(([key, value]) => {
      key = prefix + key
      if (fields.includes(key)) {
        result[key] = this.resolveValue(name, key, value)
      } else if (!value || typeof value !== 'object' || isEvalExpr(value)) {
        const field = fields.find(field => key.startsWith(field + '.'))
        if (!field) throw new ModelError(`unknown field "${key}"`)
        result[key] = value
      } else {
        this.format(name, value, key + '.', result)
      }
    })
    return result
  }
}

export namespace Model {
  export interface Extension<O = any> {
    autoInc?: boolean
    primary?: MaybeArray<Keys<O>>
    unique?: MaybeArray<Keys<O>>[]
    foreign?: {
      [K in keyof O]?: [string, string]
    }
  }

  export interface Config<O = any> extends Extension<O> {
    fields?: Field.Config<O>
    internal?: Field.Internal<O>
  }

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
      if (!capture) throw new ModelError('invalid field definition')
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
}
