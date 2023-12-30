import { Logger } from '@satorijs/core'
import { Awaitable, defineProperty, remove } from 'cosmokit'
import { Session } from './session'
import { Context } from './context'
import { createMatch, MatchResult } from './i18n'

const logger = new Logger('app')

declare module '@satorijs/core' {
  interface Context {
    perms: Permissions
    permissions: Permissions
  }

  interface Events {
    'internal/permission'(): void
  }
}

export namespace Permissions {
  export type Links<P extends string> = undefined | string[] | ((data: MatchResult<P>) => undefined | string[])
  export type Check<P extends string> = (data: MatchResult<P>, session: Partial<Session>) => Awaitable<boolean>

  export interface Config {
    authority?: number
    permissions?: string[]
    dependencies?: string[]
  }

  export interface Entry<P extends string = string> {
    pattern: P
    list?: () => string[]
    check?: Check<P>
    depends?: Links<P>
    inherits?: Links<P>
  }
}

export class Permissions {
  public store: Permissions.Entry[] = []

  constructor(public ctx: Context) {
    defineProperty(this, Context.current, ctx)
    ctx.alias('permissions', ['perms'])

    this.provide('authority.(value)', ({ value }, { user }: Partial<Session<'authority'>>) => {
      return !user || user.authority >= +value
    })

    this.provide('(name)', ({ name }, session) => {
      return session.bot?.checkPermission(name, session)
    })

    this.provide('(name)', ({ name }, session: Partial<Session<'permissions', 'permissions'>>) => {
      return session.permissions?.includes(name)
        || session.user?.permissions?.includes(name)
        || session.channel?.permissions?.includes(name)
    })
  }

  private get caller(): Context {
    return this[Context.current]
  }

  define<P extends string>(entry: Permissions.Entry<P>) {
    return this.caller.effect(() => {
      this.store.push(entry)
      return () => remove(this.store, entry)
    })
  }

  provide<P extends string>(pattern: P, check: Permissions.Check<P>) {
    return this.define({ pattern, check })
  }

  inherit<P extends string>(pattern: P, inherits: Permissions.Links<P>) {
    return this.define({ pattern, inherits })
  }

  depend<P extends string>(pattern: P, depends: Permissions.Links<P>) {
    return this.define({ pattern, depends })
  }

  list(result = new Set<string>()) {
    for (const { list } of this.store) {
      if (!list) continue
      for (const name of list()) {
        result.add(name)
      }
    }
    return result
  }

  async check(name: string, session: Partial<Session>) {
    const results = await Promise.all(this.store.map(async ({ pattern, check }) => {
      if (!check) return false
      const data = createMatch(pattern)(name)
      if (!data) return false
      try {
        return await check(data, session)
      } catch (error) {
        logger.warn(error)
        return false
      }
    }))
    return results.some(Boolean)
  }

  subgraph(type: 'inherits' | 'depends', parents: Iterable<string>, result = new Set<string>()): Set<string> {
    let name: string
    const queue = [...parents]
    while ((name = queue.shift())) {
      if (result.has(name)) continue
      result.add(name)
      for (const entry of this.store) {
        const data = createMatch(entry.pattern)(name)
        if (!data) continue
        let links = entry[type]
        if (typeof links === 'function') links = links(data)
        if (Array.isArray(links)) queue.push(...links)
      }
    }
    return result
  }

  async test(names: Iterable<string>, session: Partial<Session> = {}, cache: Map<string, Promise<boolean>> = new Map()) {
    session = session[Session.shadow] || session
    if (typeof names === 'string') names = [names]
    for (const name of this.subgraph('depends', names)) {
      const parents = [...this.subgraph('inherits', [name])]
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
