import * as utils from './koishi'
import * as memory from './memory'
import { mockModule, actualModule } from './module'

export { utils, memory }

export * from './app'
export * from './database'
export * from './memory'
export * from './mocks'
export * from './session'

mockModule('koishi-utils', () => {
  const utils1 = actualModule('koishi-utils')
  const utils2 = actualModule('./koishi')
  return { ...utils1, ...utils2 }
})
