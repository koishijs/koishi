import { Dict, remove } from 'cosmokit'
import { Schema } from '@satorijs/core'
import { Computed } from './filter'
import { Context } from './context'

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

const kSchemaOrder = Symbol('schema-order')

declare module '@satorijs/core' {
  interface Context {
    schema: SchemaService
  }

  interface Events {
    'internal/schema'(name: string): void
  }
}

export class SchemaService {
  _data: Dict<Schema> = Object.create(null)

  constructor(public ctx: Context) {
    this.extend('intercept.http', Schema.object({
      timeout: Schema.natural().role('ms').description('等待连接建立的最长时间。'),
      proxyAgent: Schema.string().description('使用的代理服务器地址。'),
      keepAlive: Schema.boolean().description('是否保持连接。'),
    }))
  }

  extend(name: string, schema: Schema, order = 0) {
    const caller = this[Context.current]
    const target = this.get(name)
    const index = target.list.findIndex(a => a[kSchemaOrder] < order)
    schema[kSchemaOrder] = order
    if (index >= 0) {
      target.list.splice(index, 0, schema)
    } else {
      target.list.push(schema)
    }
    this.ctx.emit('internal/schema', name)
    caller?.on('dispose', () => {
      remove(target.list, schema)
      this.ctx.emit('internal/schema', name)
    })
  }

  get(name: string) {
    return this._data[name] ||= Schema.intersect([])
  }

  set(name: string, schema: Schema) {
    const caller = this[Context.current]
    this._data[name] = schema
    this.ctx.emit('internal/schema', name)
    caller?.on('dispose', () => {
      delete this._data[name]
      this.ctx.emit('internal/schema', name)
    })
  }
}
