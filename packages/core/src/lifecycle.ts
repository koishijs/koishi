// @ts-nocheck
import { Promisify, remove } from 'cosmokit'
import { GetEvents, Parameters, ReturnType, ThisType } from 'cordis'
import { Context, Events, Logger } from '@satorijs/core'
import { extend } from '@koishijs/utils'

/* eslint-disable max-len */
declare module '@satorijs/core' {
  interface Context {
    /** @deprecated use `ctx.root` instead */
    app: Context
    /** @deprecated use `root.config` instead */
    options: Context.Config
    logger(name: string): Logger
    waterfall<K extends keyof GetEvents<this>>(name: K, ...args: Parameters<GetEvents<this>[K]>): Promisify<ReturnType<GetEvents<this>[K]>>
    waterfall<K extends keyof GetEvents<this>>(thisArg: ThisType<GetEvents<this>[K]>, name: K, ...args: Parameters<GetEvents<this>[K]>): Promisify<ReturnType<GetEvents<this>[K]>>
    chain<K extends keyof GetEvents<this>>(name: K, ...args: Parameters<GetEvents<this>[K]>): ReturnType<GetEvents<this>[K]>
    chain<K extends keyof GetEvents<this>>(thisArg: ThisType<GetEvents<this>[K]>, name: K, ...args: Parameters<GetEvents<this>[K]>): ReturnType<GetEvents<this>[K]>
    before<K extends BeforeEventName>(name: K, listener: BeforeEventMap[K], append?: boolean): () => boolean
    setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): () => boolean
    setInterval(callback: (...args: any[]) => void, ms: number, ...args: any[]): () => boolean
  }

  namespace Context {
    interface Private extends Context {
      createTimerDispose(timer: NodeJS.Timeout): () => boolean
    }
  }
}
/* eslint-enable max-len */

type OmitSubstring<S extends string, T extends string> = S extends `${infer L}${T}${infer R}` ? `${L}${R}` : never
type BeforeEventName = OmitSubstring<keyof Events & string, 'before-'>

export type BeforeEventMap = { [E in keyof Events & string as OmitSubstring<E, 'before-'>]: Events[E] }

extend(Context.prototype as Context.Private, {
  get app() {
    return this.root
  },

  get options() {
    return this.root.config
  },

  async waterfall(...args: [any, ...any[]]) {
    const thisArg = typeof args[0] === 'object' ? args.shift() : null
    const name = args.shift()
    for (const callback of this.lifecycle.getHooks(name, thisArg)) {
      const result = await callback.apply(thisArg, args)
      args[0] = result
    }
    return args[0]
  },

  chain(...args: [any, ...any[]]) {
    const thisArg = typeof args[0] === 'object' ? args.shift() : null
    const name = args.shift()
    for (const callback of this.lifecycle.getHooks(name, thisArg)) {
      const result = callback.apply(thisArg, args)
      args[0] = result
    }
    return args[0]
  },

  before<K extends BeforeEventName>(name: K, listener: BeforeEventMap[K], append = false) {
    const seg = (name as string).split('/')
    seg[seg.length - 1] = 'before-' + seg[seg.length - 1]
    return this.on(seg.join('/') as keyof Events, listener, !append)
  },

  createTimerDispose(timer) {
    const dispose = () => {
      clearTimeout(timer)
      if (!this.state) return
      return remove(this.state.disposables, dispose)
    }
    this.state.disposables.push(dispose)
    return dispose
  },

  setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]) {
    const dispose = this.createTimerDispose(setTimeout(() => {
      dispose()
      callback()
    }, ms, ...args))
    return dispose
  },

  setInterval(callback: (...args: any[]) => void, ms: number, ...args: any[]) {
    return this.createTimerDispose(setInterval(callback, ms, ...args))
  },
})
