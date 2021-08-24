import { types } from 'util'

export function noop(): any {}

export function isInteger(source: any) {
  return typeof source === 'number' && Math.floor(source) === source
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function enumKeys<T extends string>(data: Record<T, string | number>) {
  return Object.values(data).filter(value => typeof value === 'string') as T[]
}

export function defineEnumProperty<T extends object>(object: T, key: keyof T, value: T[keyof T]) {
  object[key] = value
  object[value as any] = key
}

const primitives = ['number', 'string', 'bigint', 'boolean', 'symbol']

export function clone<T extends unknown>(source: T): T {
  // primitive types
  if (primitives.includes(typeof source)) return source

  // null & undefined
  if (!source) return source

  // array
  if (Array.isArray(source)) return source.map(clone) as any

  // date
  if (types.isDate(source)) return new Date(source.valueOf()) as any

  // regexp
  if (types.isRegExp(source)) return new RegExp(source.source, source.flags) as any

  // fallback
  const entries = Object.entries(source).map(([key, value]) => [key, clone(value)])
  return Object.fromEntries(entries)
}

export function merge<T extends object>(head: T, base: T): T {
  Object.entries(base).forEach(([key, value]) => {
    if (typeof head[key] === 'undefined') return head[key] = base[key]
    if (typeof value === 'object' && typeof head[key] === 'object') {
      head[key] = merge(head[key], value)
    }
  })
  return head
}

export function pick<T, K extends keyof T>(source: T, keys?: Iterable<K>) {
  if (!keys) return { ...source }
  const result = {} as Pick<T, K>
  for (const key of keys) {
    result[key] = source[key]
  }
  return result
}

export function omit<T, K extends keyof T>(source: T, keys?: Iterable<K>) {
  if (!keys) return { ...source }
  const result = { ...source } as Omit<T, K>
  for (const key of keys) {
    Reflect.deleteProperty(result, key)
  }
  return result
}

export function defineProperty<T, K extends keyof T>(object: T, key: K, value: T[K]): void
export function defineProperty<T, K extends keyof any>(object: T, key: K, value: any): void
export function defineProperty<T, K extends keyof any>(object: T, key: K, value: any) {
  Object.defineProperty(object, key, { writable: true, value })
}

export function assertProperty<O, K extends keyof O>(config: O, key: K) {
  if (!config[key]) throw new Error(`missing configuration "${key}"`)
  return config[key]
}

export function coerce(val: any) {
  const { stack } = val instanceof Error ? val : new Error(val as any)
  return stack
}

export function makeArray<T>(source: T | T[]) {
  return Array.isArray(source) ? source
    : source === null || source === undefined ? []
      : [source]
}

export function renameProperty<O extends object, K extends keyof O, T extends string>(config: O, key: K, oldKey: T) {
  config[key] = Reflect.get(config, oldKey)
  Reflect.deleteProperty(config, oldKey)
}

export type Get<T extends {}, K> = K extends keyof T ? T[K] : never
export type Extract<S, T, U = S> = S extends T ? U : never
export type MaybeArray<T> = T extends unknown[] ? T : T | T[]
export type Promisify<T> = T extends Promise<unknown> ? T : Promise<T>
export type Awaitable<T> = [T] extends [Promise<unknown>] ? T : T | Promise<T>
