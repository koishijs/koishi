import { Dict, Intersect, isNullable } from './misc'

export interface Schema<T = any> extends Schema.Base<T> {
  type: string
  value?: Schema
  value2?: Schema
  values?: Schema[]
  props?: Dict<Schema>
  adapt?: Function
}

export namespace Schema {
  export type Type<T extends Schema> = T extends Schema<infer U> ? U : never

  export interface Base<T = any> {
    desc?: string
    initial?: T
    nullable?: boolean
  }

  export function Any(options: Base = {}): Schema {
    return { type: 'any', ...options }
  }

  export function String(options: Base = {}): Schema<string> {
    return { type: 'string', ...options }
  }

  export function Number(options: Base = {}): Schema<number> {
    return { type: 'number', ...options }
  }

  export function Boolean(options: Base = {}): Schema<boolean> {
    return { type: 'boolean', ...options }
  }

  export function Array<T>(value: Schema<T>, options: Base = {}): Schema<T[]> {
    return { type: 'array', value, ...options }
  }

  export function Dict<T>(value: Schema<T>, options: Base = {}): Schema<Dict<T>> {
    return { type: 'dict', value, ...options }
  }

  export function Object<T extends Dict<Schema>>(props: T, options: Base = {}): Schema<{ [K in keyof T]?: Type<T[K]> }> {
    return { type: 'object', props, ...options }
  }

  export function Merge<T extends Schema[]>(values: T, options: Base = {}): Schema<Intersect<Type<T[number]>>> {
    return { type: 'merge', values, ...options }
  }

  export function Adapt<S, T>(value: Schema<S>, value2: Schema<T>, adapt: (value: T) => S): Schema<S> {
    return { type: 'adapt', value, value2, adapt }
  }
}

export function validate(schema: Schema, value: any) {
  if (schema.nullable && isNullable(value)) return true
  switch (schema.type) {
    case 'string': return typeof value === 'string'
    case 'number': return typeof value === 'number'
    case 'boolean': return typeof value === 'boolean'
    case 'array':
      return Array.isArray(value)
        && value.every(item => validate(schema.value, item))
    case 'dict':
      return value && typeof value === 'object'
        && Object.values(value).every(item => validate(schema.value, item))
    case 'object':
      return value && typeof value === 'object'
        && Object.entries(schema.props).every(([key, item]) => validate(item, value[key]))
    default:
      throw new Error(`unsupported type "${schema.type}"`);
  }
}
