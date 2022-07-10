import { defineProperty, Logger, Promisify, remove } from '@koishijs/utils'
import { GetEvents, Parameters, ReturnType, ThisType } from 'cordis'
import { Context, Events } from './context'

/* eslint-disable max-len */
declare module './context' {
  interface Context {
    logger(name: string): Logger
    waterfall<K extends keyof GetEvents<this>>(name: K, ...args: Parameters<GetEvents<this>[K]>): Promisify<ReturnType<GetEvents<this>[K]>>
    waterfall<K extends keyof GetEvents<this>>(thisArg: ThisType<GetEvents<this>[K]>, name: K, ...args: Parameters<GetEvents<this>[K]>): Promisify<ReturnType<GetEvents<this>[K]>>
    chain<K extends keyof GetEvents<this>>(name: K, ...args: Parameters<GetEvents<this>[K]>): ReturnType<GetEvents<this>[K]>
    chain<K extends keyof GetEvents<this>>(thisArg: ThisType<GetEvents<this>[K]>, name: K, ...args: Parameters<GetEvents<this>[K]>): ReturnType<GetEvents<this>[K]>
    before<K extends BeforeEventName>(name: K, listener: BeforeEventMap[K], append?: boolean): () => boolean
    setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): () => boolean
    setInterval(callback: (...args: any[]) => void, ms: number, ...args: any[]): () => boolean
  }
}
/* eslint-enable max-len */

type OmitSubstring<S extends string, T extends string> = S extends `${infer L}${T}${infer R}` ? `${L}${R}` : never
type BeforeEventName = OmitSubstring<keyof Events & string, 'before-'>

export type BeforeEventMap = { [E in keyof Events & string as OmitSubstring<E, 'before-'>]: Events[E] }

export class SelectorService<C extends Context = Context> {
  static readonly methods = ['chain', 'waterfall', 'before', 'logger', 'setTimeout', 'setInterval']

  constructor(private app: C) {
    defineProperty(this, Context.current, app)

    app.on('internal/warning', (format, ...args) => {
      this.logger('app').warn(format, ...args)
    })
  }

  protected get caller() {
    return this[Context.current] as Context
  }

  logger(name: string) {
    return new Logger(name)
  }

  async waterfall(...args: [any, ...any[]]) {
    const thisArg = typeof args[0] === 'object' ? args.shift() : null
    const name = args.shift()
    for (const callback of this.app.lifecycle.getHooks(name, thisArg)) {
      const result = await callback.apply(thisArg, args)
      args[0] = result
    }
    return args[0]
  }

  chain(...args: [any, ...any[]]) {
    const thisArg = typeof args[0] === 'object' ? args.shift() : null
    const name = args.shift()
    for (const callback of this.app.lifecycle.getHooks(name, thisArg)) {
      const result = callback.apply(thisArg, args)
      args[0] = result
    }
    return args[0]
  }

  before<K extends BeforeEventName>(name: K, listener: BeforeEventMap[K], append = false) {
    const seg = (name as string).split('/')
    seg[seg.length - 1] = 'before-' + seg[seg.length - 1]
    return this.caller.on(seg.join('/') as keyof Events, listener, !append)
  }

  private createTimerDispose(timer: NodeJS.Timeout) {
    const dispose = () => {
      clearTimeout(timer)
      if (!this.caller.state) return
      return remove(this.caller.state.disposables, dispose)
    }
    this.caller.state.disposables.push(dispose)
    return dispose
  }

  setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]) {
    const dispose = this.createTimerDispose(setTimeout(() => {
      dispose()
      callback()
    }, ms, ...args))
    return dispose
  }

  setInterval(callback: (...args: any[]) => void, ms: number, ...args: any[]) {
    return this.createTimerDispose(setInterval(callback, ms, ...args))
  }
}

Context.service('selector', SelectorService)
