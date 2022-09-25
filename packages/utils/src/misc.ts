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

export function merge<T extends object>(head: T, base: T): T {
  Object.entries(base).forEach(([key, value]) => {
    if (typeof head[key] === 'undefined') return head[key] = base[key]
    if (typeof value === 'object' && typeof head[key] === 'object') {
      head[key] = merge(head[key], value)
    }
  })
  return head
}

export function assertProperty<O, K extends keyof O & string>(config: O, key: K) {
  if (!config[key]) throw new Error(`missing configuration "${key}"`)
  return config[key]
}

export function coerce(val: any) {
  // resolve error when stack is undefined, e.g. axios error with status code 401
  const { message, stack } = val instanceof Error && val.stack ? val : new Error(val as any)
  const lines = stack.split('\n')
  const index = lines.findIndex(line => line.endsWith(message))
  return lines.slice(index).join('\n')
}

export function renameProperty<O extends object, K extends keyof O, T extends string>(config: O, key: K, oldKey: T) {
  config[key] = Reflect.get(config, oldKey)
  Reflect.deleteProperty(config, oldKey)
}
