export function noop (): any {}

export function isInteger (source: any) {
  return typeof source === 'number' && Math.floor(source) === source
}

export async function sleep (ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function assertProperty <T> (config: T, key: keyof T) {
  if (!(key in config)) throw new Error(`missing configuration "${key}"`)
}
