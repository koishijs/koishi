/**
 * random operations
 */
export class Random {
  constructor(private value = Math.random()) {}

  bool(probability: number) {
    if (probability >= 1) return true
    if (probability <= 0) return false
    return this.value < probability
  }

  /**
   * random real
   * @param start start number
   * @param end end number
   * @returns a random real in the interval [start, end)
   */
  real(end: number): number
  real(start: number, end: number): number
  real(...args: [number, number?]): number {
    const start = args.length > 1 ? args[0] : 0
    const end = args[args.length - 1]
    return this.value * (end - start) + start
  }

  /**
   * random integer
   * @param start start number
   * @param end end number
   * @returns a random integer in the interval [start, end)
   */
  int(end: number): number
  int(start: number, end: number): number
  int(...args: [number, number?]): number {
    return Math.floor(this.real(...args))
  }

  pick <T>(source: readonly T[]) {
    return source[Math.floor(this.value * source.length)]
  }

  splice <T>(source: T[]) {
    return source.splice(Math.floor(this.value * source.length), 1)[0]
  }

  weightedPick <T extends string>(weights: Record<T, number>): T {
    const total = Object.entries(weights).reduce((prev, [_, curr]) => prev + (curr as number), 0)
    const pointer = this.value * total
    let counter = 0
    for (const key in weights) {
      counter += weights[key]
      if (pointer < counter) return key
    }
  }
}

export namespace Random {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  export function id(length = 8) {
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
  export function real(end: number): number
  export function real(start: number, end: number): number
  export function real(...args: [number, number?]): number {
    return new Random().real(...args)
  }

  /**
   * random integer
   * @param start start number
   * @param end end number
   * @returns a random integer in the interval [start, end)
   */
  export function int(end: number): number
  export function int(start: number, end: number): number
  export function int(...args: [number, number?]): number {
    return new Random().int(...args)
  }

  export function pick <T>(source: readonly T[]) {
    return new Random().pick(source)
  }

  export function splice <T>(source: T[]) {
    return new Random().splice(source)
  }

  export function multiPick <T>(source: T[], count: number) {
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

  export function weightedPick <T extends string>(weights: Record<T, number>): T {
    return new Random().weightedPick(weights)
  }

  export function bool(probability: number) {
    return new Random().bool(probability)
  }
}
