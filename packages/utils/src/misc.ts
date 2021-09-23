export function noop(): any {}

export function contain(array1: readonly any[], array2: readonly any[]) {
  return array2.every(item => array1.includes(item))
}

export function intersection<T>(array1: readonly T[], array2: readonly T[]) {
  return array1.filter(item => array2.includes(item))
}

export function difference<S>(array1: readonly S[], array2: readonly any[]) {
  return array1.filter(item => !array2.includes(item))
}

export function union<T>(array1: readonly T[], array2: readonly T[]) {
  return Array.from(new Set([...array1, ...array2]))
}

export function deduplicate<T>(array: readonly T[]) {
  return [...new Set(array)]
}

export function remove<T>(list: T[], item: T) {
  const index = list.indexOf(item)
  if (index >= 0) {
    list.splice(index, 1)
    return true
  }
}

export function valueMap<T, U>(object: Dict<T>, transform: (value: T, key: string) => U): Dict<U> {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]))
}

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
  // primitive types, null & undefined
  if (primitives.includes(typeof source)) return source
  if (!source) return source

  // array
  if (Array.isArray(source)) return source.map(clone) as any

  if (isType('Date', source)) return new Date(source.valueOf()) as any
  if (isType('RegExp', source)) return new RegExp(source.source, source.flags) as any

  // fallback
  return valueMap(source as any, clone) as any
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
    if (key in source) result[key] = source[key]
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

export function isNullable(value: any) {
  return value === null || value === undefined
}

export function makeArray<T>(source: T | T[]) {
  return Array.isArray(source) ? source : isNullable(source) ? [] : [source]
}

export function renameProperty<O extends object, K extends keyof O, T extends string>(config: O, key: K, oldKey: T) {
  config[key] = Reflect.get(config, oldKey)
  Reflect.deleteProperty(config, oldKey)
}

type Global = NodeJS.Global & Window & typeof globalThis

type GlobalClass = {
  [K in keyof Global]: Global[K] extends new (...args: any[]) => infer T ? T : never
}

const root: any = typeof self !== 'undefined' ? self : global

export function isType<K extends keyof GlobalClass>(type: K, value: any): value is GlobalClass[K] {
  return type in root && value instanceof root[type]
    || Object.prototype.toString.call(value).slice(8, -1) === type
}

export type Dict<T = any> = { [key: string]: T }
export type Get<T extends {}, K> = K extends keyof T ? T[K] : never
export type Extract<S, T, U = S> = S extends T ? U : never
export type MaybeArray<T> = [T] extends [unknown[]] ? T : T | T[]
export type Promisify<T> = [T] extends [Promise<unknown>] ? T : Promise<T>
export type Awaitable<T> = [T] extends [Promise<unknown>] ? T : T | Promise<T>
export type Intersect<U> = (U extends any ? (arg: U) => void : never) extends ((arg: infer I) => void) ? I : never
