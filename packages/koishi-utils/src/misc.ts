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

const primitives = ['number', 'string', 'bigint', 'boolean', 'symbol']

export function clone<T>(source: T): T {
  return primitives.includes(typeof source) ? source
    : Array.isArray(source) ? source.map(clone) as any
      : Object.fromEntries(Object.entries(source).map(([key, value]) => [key, clone(value)]))
}

export function pick<T, K extends keyof T>(source: T, keys: Iterable<K>) {
  const result = {} as Pick<T, K>
  for (const key of keys) {
    result[key] = source[key]
  }
  return result
}

export function omit<T, K extends keyof T>(source: T, keys: Iterable<K>) {
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
