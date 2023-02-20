import { Dict, remove } from 'cosmokit'
import { Context, Schema } from '@satorijs/core'

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

  constructor(public ctx: Context) {}

  extend(name: string, schema: Schema, order = 0) {
    const target = this.get(name)
    const index = target.list.findIndex(a => a[kSchemaOrder] < order)
    schema[kSchemaOrder] = order
    if (index >= 0) {
      target.list.splice(index, 0, schema)
    } else {
      target.list.push(schema)
    }
    this.ctx.emit('internal/schema', name)
    this[Context.current]?.on('dispose', () => {
      remove(target.list, schema)
      this.ctx.emit('internal/schema', name)
    })
  }

  get(name: string) {
    return this._data[name] ||= Schema.intersect([])
  }
}

Context.service('schema', SchemaService)
