import { MemoryDatabase } from './memory'

export default MemoryDatabase

export function createArray<T>(length: number, create: (index: number) => T) {
  return [...new Array(length).keys()].map(create)
}

export * from './app'
export * from './tests'
