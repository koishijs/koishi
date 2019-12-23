const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
export function randomId (length = 8) {
  let output = ''
  for (let index = length; index > 0; --index) {
    output += chars[Math.floor(Math.random() * 62)]
  }
  return output
}

/**
 * random real
 * @param start start number
 * @param end end number
 * @returns a random real in the interval [start, end)
 */
export function randomReal (end: number): number
export function randomReal (start: number, end: number): number
export function randomReal (...args: [number, number?]): number {
  const start = args.length > 1 ? args[0] : 0
  const end = args[args.length - 1] || 1
  return Math.random() * (end - start) + start
}

/**
 * random integer
 * @param start start number
 * @param end end number
 * @returns a random integer in the interval [start, end)
 */
export function randomInt (end: number): number
export function randomInt (start: number, end: number): number
export function randomInt (...args: [number, number?]): number {
  return Math.floor(randomReal(...args))
}

export function randomPick <T> (source: readonly T[]) {
  return source[Math.floor(Math.random() * source.length)]
}

export function randomSplice <T> (source: T[]) {
  return source.splice(Math.floor(Math.random() * source.length), 1)[0]
}

export function randomMultiPick <T> (source: T[], count: number) {
  source = source.slice()
  const result: T[] = []
  const length = Math.min(source.length, count)
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * source.length)
    const [item] = source.splice(index, 1)
    result.push(item)
  }
  return result
}

export function randomWeightedPick <T extends keyof any> (weights: Record<T, number>, value = Math.random()): T {
  const total = Object.entries(weights).reduce((prev, [_, curr]) => prev + (curr as number), 0)
  const pointer = value * total
  let counter = 0
  for (const key in weights) {
    counter += weights[key]
    if (pointer < counter) return key
  }
}

export function randomBool (probability: number) {
  if (probability >= 1) return true
  if (probability <= 0) return false
  return Math.random() / probability < 1
}
