import { Awaitable } from 'koishi'
import { Console, SocketHandle } from './server'

export * from './provider'
export * from './server'

declare module 'koishi' {
  namespace Context {
    interface Services {
      console: Console
    }
  }

  interface EventMap {
    'console/validate'(handle: SocketHandle): Awaitable<boolean>
  }

  interface Modules {
    console: typeof import('.')
  }
}

export default Console
