import { defineProperty } from 'cosmokit'
import { Eval } from 'minato'
import { Channel, User } from './database'
import { Context } from './context'
import { Session } from './session'

export namespace Computed {
  export interface Options {
    userFields?: User.Field[]
    channelFields?: Channel.Field[]
  }
}

export type Computed<T> = T | Eval.Expr<T> | ((session: Session) => T)
export type Filter = (session: Session) => boolean

declare module './context' {
  interface Context {
    $filter: FilterService
    filter: Filter
    any(): this
    never(): this
    union(arg: Filter | this): this
    intersect(arg: Filter | this): this
    exclude(arg: Filter | this): this
    user(...values: string[]): this
    self(...values: string[]): this
    guild(...values: string[]): this
    channel(...values: string[]): this
    platform(...values: string[]): this
    private(...values: string[]): this
  }
}

function property<K extends keyof Session>(ctx: Context, key: K, ...values: Session[K][]) {
  return ctx.intersect((session: Session) => {
    return values.length ? values.includes(session[key]) : !!session[key]
  })
}

export class FilterService {
  constructor(private ctx: Context) {
    defineProperty(this, Context.current, ctx)

    ctx.filter = () => true
    ctx.on('internal/runtime', (runtime) => {
      if (!runtime.uid) return
      runtime.ctx.filter = (session) => {
        return runtime.children.some(p => p.ctx.filter(session))
      }
    })
  }

  any() {
    return this.ctx.extend({ filter: () => true })
  }

  never() {
    return this.ctx.extend({ filter: () => false })
  }

  union(arg: Filter | Context) {
    const filter = typeof arg === 'function' ? arg : arg.filter
    return this.ctx.extend({ filter: s => this.ctx.filter(s) || filter(s) })
  }

  intersect(arg: Filter | Context) {
    const filter = typeof arg === 'function' ? arg : arg.filter
    return this.ctx.extend({ filter: s => this.ctx.filter(s) && filter(s) })
  }

  exclude(arg: Filter | Context) {
    const filter = typeof arg === 'function' ? arg : arg.filter
    return this.ctx.extend({ filter: s => this.ctx.filter(s) && !filter(s) })
  }

  user(...values: string[]) {
    return property(this.ctx, 'userId', ...values)
  }

  self(...values: string[]) {
    return property(this.ctx, 'selfId', ...values)
  }

  guild(...values: string[]) {
    return property(this.ctx, 'guildId', ...values)
  }

  channel(...values: string[]) {
    return property(this.ctx, 'channelId', ...values)
  }

  platform(...values: string[]) {
    return property(this.ctx, 'platform', ...values)
  }

  private() {
    return this.ctx.intersect((session) => session.isDirect)
  }
}
