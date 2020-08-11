export function noop(): any {}

export function isInteger(source: any) {
  return typeof source === 'number' && Math.floor(source) === source
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function assertProperty <O, K extends keyof O>(config: O, key: K) {
  if (!config[key]) throw new Error(`missing configuration "${key}"`)
  return config[key]
}
