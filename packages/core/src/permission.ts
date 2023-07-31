import { Context, Logger, Session } from '@satorijs/core'
import { Awaitable, Dict } from 'cosmokit'

const logger = new Logger('app')

declare module '@satorijs/core' {
  interface Context {
    permissions: Permissions
  }
}

class DAG {
  store: Map<string, Set<string>> = new Map()

  link(parent: string, children: string[]) {
    const set = this.store.get(parent)
    if (!set) {
      this.store.set(parent, new Set(children))
    } else {
      children.forEach(child => set.add(child))
    }
  }

  unlink(parent: string, children: string[]) {
    const set = this.store.get(parent)
    if (!set) return
    children.forEach(child => set.delete(child))
  }

  subgraph(parents: Iterable<string>, result = new Set<string>()): Set<string> {
    for (const parent of parents) {
      result.add(parent)
      const children = this.store.get(parent)
      if (!children) continue
      this.subgraph(children, result)
    }
    return result
  }
}

export namespace Permissions {
  export type ProvideCallback = (name: string, session: Partial<Session>) => Awaitable<boolean>
}

export class Permissions {
  #extends = new DAG()
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

  inherit(parent: string, children: string[]) {
    this.#extends.link(parent, children)
    this[Context.current]?.on('dispose', () => {
      this.#extends.unlink(parent, children)
    })
  }

  depend(parent: string, children: string[]) {
    this.#depends.link(parent, children)
    this[Context.current]?.on('dispose', () => {
      this.#depends.unlink(parent, children)
    })
  }

  async test(x: string[], y: Iterable<string>, session: Partial<Session> = {}) {
    outer: for (const name of this.#depends.subgraph(y)) {
      const parents = [...this.#extends.subgraph([name])]
      if (parents.some(parent => x.includes(parent))) continue
      for (const parent of parents) {
        if (await this.check(parent, session)) continue outer
      }
      return false
    }
    return true
  }
}

Context.service('permissions', Permissions)
