import { Logger, Promisify, remove } from '@koishijs/utils'
import { Context, Events } from 'cordis'
import { Session } from './protocol/session'

declare module 'cordis' {
  interface Context extends SelectorService.Mixin {
    selector: SelectorService
  }

  namespace Context {
    interface Meta {
      filter: Filter
    }
  }
}

export type Filter = (session: Session) => boolean

export namespace SelectorService {
  export interface Mixin {
    logger(name: string): Logger
    any(): Context
    never(): Context
    union(arg: Filter | Context): Context
    intersect(arg: Filter | Context): Context
    exclude(arg: Filter | Context): Context
    user(...values: string[]): Context
    self(...values: string[]): Context
    guild(...values: string[]): Context
    channel(...values: string[]): Context
    platform(...values: string[]): Context
    private(...values: string[]): Context
    waterfall<K extends keyof Events>(name: K, ...args: Parameters<Events[K]>): Promisify<ReturnType<Events[K]>>
    waterfall<K extends keyof Events>(thisArg: ThisParameterType<Events[K]>, name: K, ...args: Parameters<Events[K]>): Promisify<ReturnType<Events[K]>>
    chain<K extends keyof Events>(name: K, ...args: Parameters<Events[K]>): ReturnType<Events[K]>
    chain<K extends keyof Events>(thisArg: ThisParameterType<Events[K]>, name: K, ...args: Parameters<Events[K]>): ReturnType<Events[K]>
    before<K extends BeforeEventName>(name: K, listener: BeforeEventMap[K], append?: boolean): () => boolean
    setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): () => boolean
    setInterval(callback: (...args: any[]) => void, ms: number, ...args: any[]): () => boolean
  }
}

type OmitSubstring<S extends string, T extends string> = S extends `${infer L}${T}${infer R}` ? `${L}${R}` : never
type BeforeEventName = OmitSubstring<keyof Events & string, 'before-'>

export type BeforeEventMap = { [E in keyof Events & string as OmitSubstring<E, 'before-'>]: Events[E] }

function property<K extends keyof Session>(ctx: Context, key: K, ...values: Session[K][]) {
  return ctx.intersect((session: Session) => {
    return values.length ? values.includes(session[key]) : !!session[key]
  })
}

export class SelectorService {
  constructor(private app: Context) {
    this[Context.current] = app

    app.filter = () => true

    app.on('internal/warning', (format, ...args) => {
      this.logger('app').warn(format, ...args)
    })

    app.on('internal/runtime', (runtime) => {
      if (!runtime.uid) return
      runtime.context.filter = (session) => {
        return runtime.children.some(p => p.context.filter(session))
      }
    })
  }

  protected get caller() {
    return this[Context.current]
  }

  any() {
    return this.caller.extend({ filter: () => true })
  }

  never() {
    return this.caller.extend({ filter: () => false })
  }

  union(arg: Filter | Context) {
    const caller = this.caller
    const filter = typeof arg === 'function' ? arg : arg.filter
    return this.caller.extend({ filter: s => caller.filter(s) || filter(s) })
  }

  intersect(arg: Filter | Context) {
    const caller = this.caller
    const filter = typeof arg === 'function' ? arg : arg.filter
    return this.caller.extend({ filter: s => caller.filter(s) && filter(s) })
  }

  exclude(arg: Filter | Context) {
    const caller = this.caller
    const filter = typeof arg === 'function' ? arg : arg.filter
    return this.caller.extend({ filter: s => caller.filter(s) && !filter(s) })
  }

  logger(name: string) {
    return new Logger(name)
  }

  user(...values: string[]) {
    return property(this.caller, 'userId', ...values)
  }

  self(...values: string[]) {
    return property(this.caller, 'selfId', ...values)
  }

  guild(...values: string[]) {
    return property(this.caller, 'guildId', ...values)
  }

  channel(...values: string[]) {
    return property(this.caller, 'channelId', ...values)
  }

  platform(...values: string[]) {
    return property(this.caller, 'platform', ...values)
  }

  private(...values: string[]) {
    return property(this.caller.exclude(property(this.caller, 'guildId')), 'userId', ...values)
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

Context.service('selector', {
  constructor: SelectorService,
  methods: [
    'any', 'never', 'union', 'intersect', 'exclude', 'select',
    'user', 'self', 'guild', 'channel', 'platform', 'private',
    'chain', 'waterfall', 'before', 'logger', 'setTimeout', 'setInterval',
  ],
})
