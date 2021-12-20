import { Awaitable } from 'koishi'
import { Console, SocketHandle } from './server'

export * from './provider'
export * from './server'

type ConsoleServices = {
  [K in keyof Console.Services as `console/${K}`]: Console.Services[K]
}

declare module 'koishi' {
  namespace Context {
    interface Services extends ConsoleServices {
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
