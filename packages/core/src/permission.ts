import { Context, Logger, Session } from '@satorijs/core'
import { Awaitable, Dict, remove } from 'cosmokit'
import { Computed } from './filter'

const logger = new Logger('app')

declare module '@satorijs/core' {
  interface Context {
    permissions: Permissions
  }

  interface Events {
    'internal/permission'(): void
  }
}

class DAG {
  store: Map<string, Map<string, Computed<boolean>[]>> = new Map()

  define(name: string) {
    this.delete(name)
    this.store.set(name, new Map())
  }

  delete(name: string) {
    this.store.delete(name)
    for (const map of this.store.values()) {
      map.delete(name)
    }
  }

  link(source: string, target: string, condition: Computed<boolean>) {
    if (!this.store.has(source)) this.store.set(source, new Map())
    const map = this.store.get(source)
    if (!map.has(target)) map.set(target, [])
    map.get(target).push(condition)
  }

  unlink(source: string, target: string, condition: Computed<boolean>) {
    const list = this.store.get(source)?.get(target)
    if (list) remove(list, condition)
  }

  subgraph(parents: Iterable<string>, session: Partial<Session>, result = new Set<string>()): Set<string> {
    let node: string
    const queue = [...parents]
    while ((node = queue.shift())) {
      if (result.has(node)) continue
      result.add(node)
      const map = this.store.get(node)
      if (!map) continue
      for (const [key, conditions] of map) {
        if (conditions.every(value => !session.resolve(value))) continue
        queue.push(key)
      }
    }
    return result
  }
}

export namespace Permissions {
  export type ProvideCallback = (name: string, session: Partial<Session>) => Awaitable<boolean>
}

export class Permissions {
  #inherits = new DAG()
  #depends = new DAG()
  #providers: Dict<Permissions.ProvideCallback> = Object.create(null)

  constructor(public ctx: Context) {
    this.provide('authority.*', (name, { user }) => {
      const value = +name.slice(10)
      return !user || user.authority >= value
    })

    this.provide('bot.*', async (name, session) => {
      return session.bot?.supports(name.slice(4), session)
    })

    this.provide('*', async (name, session) => {
      return session.permissions?.includes(name)
        || session.user?.permissions?.includes(name)
        || session.channel?.permissions?.includes(name)
    })
  }

  private get caller(): Context {
    return this[Context.current]
  }

  provide(name: string, callback: Permissions.ProvideCallback) {
    this.#providers[name] = callback
    return this.caller?.collect('permission-provide', () => {
      return delete this.#providers[name]
    })
  }

  async check(name: string, session: Partial<Session>) {
    try {
      const callbacks = Object.entries(this.#providers)
        .filter(([key]) => name === key || key.endsWith('*') && name.startsWith(key.slice(0, -1)))
        .map(([key, value]) => value)
      if (!callbacks.length) return false
      for (const callback of callbacks) {
        if (await callback(name, session)) return true
      }
      return false
    } catch (error) {
      logger.warn(error)
      return false
    }
  }

  authority(value: number, name: string) {
    if (typeof value !== 'number') return
    this.inherit(`authority.${value}`, name)
  }

  define(name: string, inherits: string[]) {
    this.#inherits.define(name)
    this.ctx.emit('internal/permission')
    for (const permission of inherits) {
      this.inherit(name, permission)
    }
    return this.caller?.collect('permission-define', () => {
      this.#inherits.delete(name)
      this.ctx.emit('internal/permission')
    })
  }

  inherit(child: string, parent: string, condition: Computed<boolean> = true) {
    this.#inherits.link(parent, child, condition)
    return this.caller?.collect('permission-inherit', () => {
      this.#inherits.unlink(parent, child, condition)
    })
  }

  depend(dependent: string, dependency: string, condition: Computed<boolean> = true) {
    this.#depends.link(dependent, dependency, condition)
    return this.caller?.collect('permission-depend', () => {
      this.#depends.unlink(dependent, dependency, condition)
    })
  }

  list() {
    return [...this.#inherits.store.keys()]
  }

  async test(y: Iterable<string>, session: Partial<Session> = {}) {
    const cache: Dict<Promise<boolean>> = Object.create(null)
    for (const name of this.#depends.subgraph(y, session)) {
      const parents = [...this.#inherits.subgraph([name], session)]
      const results = await Promise.all(parents.map(parent => cache[parent] ||= this.check(parent, session)))
      if (results.some(result => result)) continue
      return false
    }
    return true
  }
}

Context.service('permissions', Permissions)
