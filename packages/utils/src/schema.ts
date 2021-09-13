import { Dict, Intersect, isNullable, valueMap } from './misc'

export interface Schema<T = any> extends Schema.Data<T> {
  resolve(value: any): T extends {} ? Partial<T> : T
}

export function Schema<T>(schema: Schema.Data<T>): Schema<T> {
  return { ...schema, resolve: value => Schema.resolve(schema, value) }
}

export namespace Schema {
  export type Type<T extends Schema> = T extends Schema<infer U> ? U : never

  export interface Base<T = any> {
    desc?: string
    fallback?: T extends {} ? Partial<T> : T
    required?: boolean
  }

  export interface Data<T = any> extends Base<T> {
    type: string
    value?: Schema
    value2?: Schema
    values?: Schema[]
    props?: Dict<Schema>
    adapt?: Function
  }

  export function any(options: Base = {}): Schema {
    return Schema({ type: 'any', ...options })
  }

  export function string(options: Base = {}): Schema<string> {
    return Schema({ type: 'string', ...options })
  }

  export function number(options: Base = {}): Schema<number> {
    return Schema({ type: 'number', ...options })
  }

  export function boolean(options: Base = {}): Schema<boolean> {
    return Schema({ type: 'boolean', ...options })
  }

  export function array<T>(value: Schema<T>, options: Base = {}): Schema<T[]> {
    return Schema({ type: 'array', value, ...options })
  }

  export function dict<T>(value: Schema<T>, options: Base = {}): Schema<Dict<T>> {
    return Schema({ type: 'dict', value, ...options })
  }

  export function object<T extends Dict<Schema>>(props: T, options: Base = {}): Schema<{ [K in keyof T]?: Type<T[K]> }> {
    return Schema({ type: 'object', props, ...options })
  }

  export function merge<T extends Schema[]>(values: T, options: Base = {}): Schema<Intersect<Type<T[number]>>> {
    return Schema({ type: 'merge', values, ...options })
  }

  export function extend<S, T>(value: Schema<S>, value2: Schema<T>): Schema<S & T> {
    return Schema({ type: 'extend', value, value2 })
  }

  export function adapt<S, T>(value: Schema<S>, value2: Schema<T>, adapt: (value: T) => S): Schema<S> {
    return Schema({ type: 'adapt', value, value2, adapt })
  }

  export function resolve(schema: Schema.Data, value: any) {
    if (isNullable(value)) {
      if (!schema.required) return schema.fallback ?? value
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
        return { ...value, ...valueMap(schema.props, (schema, key) => resolve(schema, value[key])) }

      default:
        throw new TypeError(`unsupported type "${schema.type}"`)
    }
  }
}
