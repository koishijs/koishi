import { Dict, Intersect, isNullable, valueMap } from './misc'

export interface Schema<T = any> extends Schema.Base<T> {
  type: string
  primary?: string
  value?: Schema
  value2?: Schema
  values?: T[]
  list?: Schema[]
  dict?: Dict<Schema>
  adapt?: Function
}

export namespace Schema {
  export type Type<T extends Schema> = T extends Schema<infer U> ? U : never

  export interface Base<T = any> {
    desc?: string
    _default?: T extends {} ? Partial<T> : T
    _required?: boolean
    _hidden?: boolean
    _comment?: string
  }

  interface Chainable<T> extends Schema<T> {}

  class Chainable<T> {
    constructor(schema: Schema<T>) {
      Object.assign(this, schema)
    }

    default(value: T) {
      this._default = value
      return this
    }

    required() {
      this._required = true
      return this
    }

    hidden() {
      this._hidden = true
      return this
    }

    comment(text: string) {
      this._comment = text
      return this
    }
  }

  export function any(desc?: string) {
    return new Chainable({ type: 'any', desc })
  }

  export function string(desc?: string) {
    return new Chainable<string>({ type: 'string', desc })
  }

  export function number(desc?: string) {
    return new Chainable<number>({ type: 'number', desc })
  }

  export function boolean(desc?: string) {
    return new Chainable<boolean>({ type: 'boolean', desc })
  }

  export function array<T>(value: Schema<T>, desc?: string) {
    return new Chainable<T[]>({ type: 'array', value, desc })
  }

  export function dict<T>(value: Schema<T>, desc?: string) {
    return new Chainable<Dict<T>>({ type: 'dict', value, desc })
  }

  export function object<T extends Dict<Schema>>(dict: T, desc?: string) {
    return new Chainable<{ [K in keyof T]?: Type<T[K]> }>({ type: 'object', dict, desc })
  }

  export function choose<T extends string>(values: T[], desc?: string) {
    return new Chainable<T>({ type: 'choose', values, desc })
  }

  export function select<T extends Dict<Schema>, K extends string>(dict: T, primary: K, desc?: string) {
    return new Chainable<Intersect<Type<T[string]>> & { [P in K]: keyof T }>({ type: 'select', dict, primary, desc })
  }

  export function merge<T extends Schema[]>(list: T, desc?: string) {
    return new Chainable<Intersect<Type<T[number]>>>({ type: 'merge', list, desc })
  }

  export function adapt<S, T>(value: Schema<S>, value2: Schema<T>, adapt: (value: T) => S): Schema<S> {
    return { type: 'adapt', value, value2, adapt }
  }

  export function resolve(schema: Schema, value: any) {
    if (isNullable(value)) {
      if (!schema._required) return schema._default ?? value
      throw new TypeError(`missing required value`)
    }

    switch (schema.type) {
      case 'string':
      case 'number':
      case 'boolean':
        if (typeof value === schema.type) return value
        throw new TypeError(`expected ${schema.type} but got ${value}`)

      case 'array':
        if (!Array.isArray(value)) throw new TypeError(`expected array but got ${value}`)
        return value.map(item => resolve(schema.value, item))

      case 'dict':
        if (!value || typeof value !== 'object') throw new TypeError(`expected dict but got ${value}`)
        return valueMap(value, item => resolve(schema.value, item))

      case 'object':
        if (!value || typeof value !== 'object') throw new TypeError(`expected object but got ${value}`)
        return { ...value, ...valueMap(schema.dict, (schema, key) => resolve(schema, value[key])) }

      default:
        throw new TypeError(`unsupported type "${schema.type}"`)
    }
  }
}
