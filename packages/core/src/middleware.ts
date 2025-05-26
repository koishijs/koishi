import { coerce, makeArray, Random } from '@koishijs/utils'
import { Awaitable, defineProperty, Dict, Time } from 'cosmokit'
import { EventOptions, Fragment, h, Hook } from '@satorijs/core'
import { Session } from './session'
import { Context } from './context'
import { Channel, User } from './database'

declare module './context' {
  interface Context {
    $processor: Processor
    middleware<S extends Session = Session>(middleware: Middleware<S>, prepend?: boolean): () => boolean
    match(pattern: string | RegExp, response: Fragment, options?: Matcher.Options & { i18n?: false }): () => boolean
    match(pattern: string, response: string, options: Matcher.Options & { i18n: true }): () => boolean
  }

  interface Events {
    'before-attach-channel'(session: Session, fields: Set<Channel.Field>): void
    'attach-channel'(session: Session): Awaitable<void | boolean>
    'before-attach-user'(session: Session, fields: Set<User.Field>): void
    'attach-user'(session: Session): Awaitable<void | boolean>
    'before-attach'(session: Session): void
    'attach'(session: Session): void
    'middleware'(session: Session): void
  }
}

export class SessionError extends Error {
  constructor(public path: string | string[], public param?: Dict) {
    super(makeArray(path)[0])
  }
}

export type Next = (next?: Next.Callback) => Promise<void | Fragment>
export type Middleware<S extends Session = Session> = (session: S, next: Next) => Awaitable<void | Fragment>

export namespace Next {
  export const MAX_DEPTH = 64

  export type Queue = ((next?: Next) => Awaitable<void | Fragment>)[]
  export type Callback = void | string | ((next?: Next) => Awaitable<void | Fragment>)

  export async function compose(callback: Callback, next?: Next) {
    return typeof callback === 'function' ? callback(next) : callback
  }
}

export interface Matcher extends Matcher.Options {
  context: Context
  pattern: string | RegExp
  response: Matcher.Response
}

export namespace Matcher {
  export type Response = Fragment | ((session: Session, params: [string, ...string[]]) => Awaitable<Fragment>)

  export interface Options {
    i18n?: boolean
    appel?: boolean
    fuzzy?: boolean
    regex?: boolean
  }
}

export class Processor {
  _hooks: Hook[] = []
  _sessions: Dict<Session> = Object.create(null)
  _matchers = new Set<Matcher>()

  constructor(private ctx: Context) {
    defineProperty(this, Context.current, ctx)

    // bind built-in event listeners
    this.middleware(this.attach.bind(this), true)
    ctx.on('message', this._handleMessage.bind(this))

    ctx.before('attach-user', (session, fields) => {
      session.collect('user', session.argv, fields)
    })

    ctx.before('attach-channel', (session, fields) => {
      session.collect('channel', session.argv, fields)
    })

    ctx.component('execute', async (attrs, children, session) => {
      return session.execute(children.join(''), true)
    }, { session: true })

    ctx.component('prompt', async (attrs, children, session) => {
      await session.send(children)
      return session.prompt()
    }, { session: true })

    ctx.component('i18n', async (attrs, children, session) => {
      return session.i18n(attrs.path, children)
    }, { session: true })

    ctx.component('random', async (attrs, children) => {
      return Random.pick(children)
    })

    ctx.component('plural', async (attrs, children) => {
      const path = attrs.count in children ? attrs.count : children.length - 1
      return children[path]
    })

    const units = ['day', 'hour', 'minute', 'second'] as const

    ctx.component('i18n:time', (attrs, children, session) => {
      let ms = +attrs.value
      for (let index = 0; index < 3; index++) {
        const major = Time[units[index]]
        const minor = Time[units[index + 1]]
        if (ms >= major - minor / 2) {
          ms += minor / 2
          let result = Math.floor(ms / major) + ' ' + session.text('general.' + units[index])
          if (ms % major > minor) {
            result += ` ${Math.floor(ms % major / minor)} ` + session.text('general.' + units[index + 1])
          }
          return result
        }
      }
      return Math.round(ms / Time.second) + ' ' + session.text('general.second')
    }, { session: true })

    ctx.before('attach', (session) => {
      for (const matcher of this._matchers) {
        this._executeMatcher(session, matcher)
        if (session.response) return
      }
    })
  }

  middleware(middleware: Middleware, options?: boolean | EventOptions) {
    if (typeof options !== 'object') {
      options = { prepend: options }
    }
    return this.ctx.lifecycle.register('middleware', this._hooks, middleware, options)
  }

  match(pattern: string | RegExp, response: Matcher.Response, options: Matcher.Options) {
    const matcher: Matcher = { ...options, context: this.ctx, pattern, response }
    this._matchers.add(matcher)
    return this.ctx.collect('shortcut', () => {
      return this._matchers.delete(matcher)
    })
  }

  private _executeMatcher(session: Session, matcher: Matcher) {
    const { stripped, quote } = session
    const { appel, context, i18n, regex, fuzzy, pattern, response } = matcher
    if ((appel || stripped.hasAt) && !stripped.appel) return
    if (!context.filter(session)) return
    let content = stripped.content
    if (quote?.content) content += ' ' + quote.content

    let params: [string, ...string[]] = null
    const match = (pattern: any) => {
      if (!pattern) return
      if (typeof pattern === 'string') {
        if (!fuzzy && content !== pattern || !content.startsWith(pattern)) return
        params = [content, content.slice(pattern.length)]
        if (fuzzy && !stripped.appel && params[1].match(/^\S/)) {
          params = null
        }
      } else {
        params = pattern.exec(content)
      }
    }

    if (!i18n) {
      match(pattern)
    } else {
      for (const locale of this.ctx.i18n.fallback([])) {
        const store = this.ctx.i18n._data[locale]
        let value = store?.[pattern as string] as string | RegExp
        if (!value) continue
        if (regex) {
          const rest = fuzzy ? `(?:${stripped.appel ? '' : '\\s+'}([\\s\\S]*))?` : ''
          value = new RegExp(`^(?:${value})${rest}$`)
        }
        match(value)
        if (!params) continue
        session.locales = [locale]
        break
      }
    }

    if (!params) return
    session.response = async () => {
      const output = await session.resolve(response, params)
      return h.normalize(output, params.map(source => source ? h.parse(source) : ''))
    }
  }

  private async attach(session: Session, next: Next) {
    this.ctx.emit(session, 'before-attach', session)

    if (this.ctx.database) {
      if (!session.isDirect) {
        // attach group data
        const channelFields = new Set<Channel.Field>(['flag', 'assignee', 'guildId', 'permissions', 'locales'])
        this.ctx.emit('before-attach-channel', session, channelFields)
        const channel = await session.observeChannel(channelFields)
        // for backwards compatibility
        channel.guildId = session.guildId

        // emit attach event
        if (await this.ctx.serial(session, 'attach-channel', session)) return

        // ignore some group calls
        if (channel.flag & Channel.Flag.ignore) return
        if (channel.assignee !== session.selfId && !session.stripped.atSelf) return
      }

      // attach user data
      // authority is for suggestion
      const userFields = new Set<User.Field>(['id', 'flag', 'authority', 'permissions', 'locales'])
      this.ctx.emit('before-attach-user', session, userFields)
      const user = await session.observeUser(userFields)

      // emit attach event
      if (await this.ctx.serial(session, 'attach-user', session)) return

      // ignore some user calls
      if (user.flag & User.Flag.ignore) return
    }

    this.ctx.emit(session, 'attach', session)
    if (session.response) return session.response()
    return next()
  }

  private async _handleMessage(session: Session) {
    // ignore self messages
    if (session.selfId === session.userId) return

    // preparation
    this._sessions[session.id] = session
    const queue: Next.Queue = this.ctx.lifecycle
      .filterHooks(this._hooks, session)
      .map(({ callback }) => callback.bind(null, session))

    // execute middlewares
    let index = 0
    const next: Next = async (callback) => {
      try {
        if (!this._sessions[session.id]) {
          throw new Error('isolated next function detected')
        }
        if (callback !== undefined) {
          queue.push(next => Next.compose(callback, next))
          if (queue.length > Next.MAX_DEPTH) {
            throw new Error(`middleware stack exceeded ${Next.MAX_DEPTH}`)
          }
        }
        return await queue[index++]?.(next)
      } catch (error) {
        if (error instanceof SessionError) {
          return session.text(error.path, error.param)
        }
        const stack = coerce(error)
        this.ctx.logger('session').warn(`${session.content}\n${stack}`)
      }
    }

    try {
      const result = await next()
      if (result) await session.send(result)
    } finally {
      // update session map
      delete this._sessions[session.id]

      // flush user & group data
      await session.user?.$update()
      await session.channel?.$update()
      await session.guild?.$update()
      this.ctx.emit(session, 'middleware', session)
    }
  }
}

export namespace SharedCache {
  export interface Entry<T> {
    value: T
    key: string
    refs: Set<number>
  }
}

export class SharedCache<T> {
  #keyMap = new Map<string, SharedCache.Entry<T>>()

  get(ref: number, key: string) {
    const entry = this.#keyMap.get(key)
    if (!entry) return
    entry.refs.add(ref)
    return entry.value
  }

  set(ref: number, key: string, value: T) {
    let entry = this.#keyMap.get(key)
    if (entry) {
      entry.value = value
    } else {
      entry = { value, key, refs: new Set() }
      this.#keyMap.set(key, entry)
    }
    entry.refs.add(ref)
  }

  delete(ref: number) {
    for (const key of [...this.#keyMap.keys()]) {
      const { refs } = this.#keyMap.get(key)
      refs.delete(ref)
      if (!refs.size) {
        this.#keyMap.delete(key)
      }
    }
  }
}
