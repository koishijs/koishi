import { Awaitable, defineProperty, Dict } from '@koishijs/utils'
import { Adapter } from './adapter'
import { Context } from './context'
import { Database } from './database'

export abstract class Service<T> {
  protected abstract start(): Awaitable<void>
  protected abstract stop(): Awaitable<void>

  constructor(public ctx: Context, public config?: T) {
    ctx.on('connect', () => this.start())
    ctx.on('disconnect', () => this.stop())
  }
}

export namespace Service {
  export interface Injection {
    database: Database
    bots: Adapter.BotList
  }

  export interface Options {
    dynamic?: boolean
  }

  export const registry: Dict<Options> = {}

  export function register(key: keyof Injection, options: Options = {}) {
    registry[key] = options
    if (Object.prototype.hasOwnProperty.call(Context.prototype, key)) return
    const privateKey = Symbol(key)
    Object.defineProperty(Context.prototype, key, {
      get() {
        const value = this.app[privateKey]
        if (!value) return
        defineProperty(value, Context.current, this)
        return value
      },
      set(value) {
        if (this.app[privateKey] && !registry[key].dynamic) {
          this.logger(key).warn('service is overwritten')
        }
        defineProperty(this.app, privateKey, value)
        this.emit('service/' + key)
      },
    })
  }

  register('database')
  register('bots')
}
