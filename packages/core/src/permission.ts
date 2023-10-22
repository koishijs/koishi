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

export interface PermissionConfig {
  authority?: number
  permissions?: string[]
  dependencies?: string[]
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
  _inherits = new DAG()
  _depends = new DAG()
  _providers: Dict<Permissions.ProvideCallback> = Object.create(null)

  constructor(public ctx: Context) {
    this.provide('authority.*', (name, { user }: Partial<Session<Context, 'authority'>>) => {
      const value = +name.slice(10)
      return !user || user.authority >= value
    })

    this.provide('*', (name, session) => {
      return session.bot?.checkPermission(name, session)
    })

    this.provide('*', (name, session: Partial<Session<Context, 'permissions', 'permissions'>>) => {
      return session.permissions?.includes(name)
        || session.user?.permissions?.includes(name)
        || session.channel?.permissions?.includes(name)
    })
  }

  private get caller(): Context {
    return this[Context.current]
  }

  provide(name: string, callback: Permissions.ProvideCallback) {
    this._providers[name] = callback
    return this.caller?.collect('permission-provide', () => {
      return delete this._providers[name]
    })
  }

  async check(name: string, session: Partial<Session>) {
    try {
      const callbacks = Object.entries(this._providers)
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

  config(name: string, config: PermissionConfig = {}, defaultAuthority = 0) {
    for (const dep of config.dependencies || []) {
      this._depends.link(name, dep, true)
    }
    const children = config.permissions || []
    if (!config.permissions || typeof config.authority === 'number') {
      children.push(`authority.${config.authority ?? defaultAuthority}`)
    }
    for (const child of children) {
      this._inherits.link(name, child, true)
    }
    return this.caller?.collect('permission-config', () => {
      this._depends.delete(name)
      this._inherits.delete(name)
      this.ctx.emit('internal/permission')
    })
  }

  define(name: string, inherits: string[]) {
    this._inherits.define(name)
    this.ctx.emit('internal/permission')
    for (const permission of inherits) {
      this.inherit(name, permission)
    }
    return this.caller?.collect('permission-define', () => {
      this._inherits.delete(name)
      this.ctx.emit('internal/permission')
    })
  }

  inherit(child: string, parent: string, condition: Computed<boolean> = true) {
    this._inherits.link(parent, child, condition)
    return this.caller?.collect('permission-inherit', () => {
      this._inherits.unlink(parent, child, condition)
    })
  }

  depend(dependent: string, dependency: string, condition: Computed<boolean> = true) {
    this._depends.link(dependent, dependency, condition)
    return this.caller?.collect('permission-depend', () => {
      this._depends.unlink(dependent, dependency, condition)
    })
  }

  list() {
    return [...this._inherits.store.keys()]
  }

  async test(names: Iterable<string>, session: Partial<Session> = {}, cache: Map<string, Promise<boolean>> = new Map()) {
    session = session[Session.shadow] || session
    if (typeof names === 'string') names = [names]
    for (const name of this._depends.subgraph(names, session)) {
      const parents = [...this._inherits.subgraph([name], session)]
      const results = await Promise.all(parents.map(parent => {
        let result = cache.get(parent)
        if (!result) {
          result = this.check(parent, session)
          cache.set(parent, result)
        }
        return result
      }))
      if (results.some(result => result)) continue
      return false
    }
    return true
  }
}

Context.service('permissions', Permissions)
