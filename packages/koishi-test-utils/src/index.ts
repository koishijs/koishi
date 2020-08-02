import * as utils from './koishi'
import * as memory from './memory'

export { utils, memory }

export * from './app'
export * from './database'
export * from './memory'
export * from './mocks'
export * from './server'
export * from './session'

jest.mock('koishi-utils', () => {
  const utils1 = jest.requireActual('koishi-utils')
  const utils2 = jest.requireActual('./koishi')
  return { ...utils1, ...utils2 }
})
