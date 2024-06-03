import { defineProperty } from 'cosmokit'
import { Eval } from 'minato'
import { Schema } from '@satorijs/core'
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
  constructor(private app: Context) {
    defineProperty(this, Context.current, app)

    app.filter = () => true
    app.on('internal/runtime', (runtime) => {
      if (!runtime.uid) return
      runtime.ctx.filter = (session) => {
        return runtime.children.some(p => p.ctx.filter(session))
      }
    })
  }

  protected get caller() {
    return this[Context.current] as Context
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
    return caller.extend({ filter: s => caller.filter(s) || filter(s) })
  }

  intersect(arg: Filter | Context) {
    const caller = this.caller
    const filter = typeof arg === 'function' ? arg : arg.filter
    return caller.extend({ filter: s => caller.filter(s) && filter(s) })
  }

  exclude(arg: Filter | Context) {
    const caller = this.caller
    const filter = typeof arg === 'function' ? arg : arg.filter
    return caller.extend({ filter: s => caller.filter(s) && !filter(s) })
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
}

declare global {
  interface Schemastery<S, T> {
    computed(options?: Computed.Options): Schema<Computed<S>, Computed<T>>
  }

  namespace Schemastery {
    interface Static {
      path(options?: Path.Options): Schema<string>
      filter(): Schema<Computed<boolean>>
      computed<X>(inner: X, options?: Computed.Options): Schema<Computed<TypeS<X>>, Computed<TypeT<X>>>
      dynamic(name: string): Schema
    }

    namespace Path {
      interface Options {
        filters?: Filter[]
        allowCreate?: boolean
      }

      type Filter = FileFilter | 'file' | 'directory'

      interface FileFilter {
        name: string
        extensions: string[]
      }
    }
  }
}

Schema.dynamic = function dynamic(name) {
  return Schema.any().role('dynamic', { name }) as never
}

Schema.filter = function filter() {
  return Schema.any().role('filter')
}

Schema.computed = function computed(inner, options = {}) {
  return Schema.union([
    Schema.from(inner),
    Schema.object({
      $switch: Schema.object({
        branches: Schema.array(Schema.object({
          case: Schema.any(),
          then: Schema.from(inner),
        })),
        default: Schema.from(inner),
      }),
    }).hidden(),
    Schema.any().hidden(),
  ]).role('computed', options)
}

Schema.path = function path(options = {}) {
  return Schema.string().role('path', options)
}

Schema.prototype.computed = function computed(this: Schema, options = {}) {
  return Schema.computed(this, options).default(this.meta.default)
}
