import { Context, Logger, Session } from '@satorijs/core'
import { Awaitable, Dict, remove } from 'cosmokit'
import { Computed } from './filter'

const logger = new Logger('app')

declare module '@satorijs/core' {
  interface Context {
    permissions: Permissions
  }
}

class DAG {
  store: Map<string, Map<string, Computed<boolean>[]>> = new Map()

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
  }

  provide(name: string, callback: Permissions.ProvideCallback) {
    this.#providers[name] = callback
    this[Context.current]?.on('dispose', () => {
      delete this.#providers[name]
    })
  }

  async check(name: string, session: Partial<Session>) {
    try {
      const callbacks = Object.entries(this.#providers)
        .filter(([key]) => name === key || key.endsWith('*') && name.startsWith(key.slice(0, -1)))
        .map(([key, value]) => value)
      if (!callbacks.length) return false
      for (const callback of callbacks) {
        if (!await callback(name, session)) return false
      }
      return true
    } catch (error) {
      logger.warn(error)
      return false
    }
  }

  inherit(parent: string, child: string, condition: Computed<boolean> = true) {
    // use child as source and parent as target
    this.#inherits.link(child, parent, condition)
    this[Context.current]?.on('dispose', () => {
      this.#inherits.unlink(child, parent, condition)
    })
  }

  depend(dependent: string, dependency: string, condition: Computed<boolean> = true) {
    this.#depends.link(dependent, dependency, condition)
    this[Context.current]?.on('dispose', () => {
      this.#depends.unlink(dependent, dependency, condition)
    })
  }

  async test(x: string[], y: Iterable<string>, session: Partial<Session> = {}) {
    const cache: Dict<Promise<boolean>> = Object.create(null)
    for (const name of this.#depends.subgraph(y, session)) {
      const parents = [...this.#inherits.subgraph([name], session)]
      if (parents.some(parent => x.includes(parent))) continue
      const results = await Promise.all(parents.map(parent => cache[parent] ||= this.check(parent, session)))
      if (results.some(result => result)) continue
      return false
    }
    return true
  }
}

Context.service('permissions', Permissions)
