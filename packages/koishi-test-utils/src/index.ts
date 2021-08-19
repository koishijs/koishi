import { Logger } from 'koishi-utils'
import { MemoryDatabase } from './memory'

export default MemoryDatabase

const logger = new Logger('test')

process.on('unhandledRejection', (error) => {
  logger.warn(error)
})

export function createArray<T>(length: number, create: (index: number) => T) {
  return [...new Array(length).keys()].map(create)
}

export * from './app'
export * from './tests'
