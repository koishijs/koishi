import { coerce, escapeRegExp, makeArray, Random } from '@koishijs/utils'
import { Awaitable, defineProperty, Dict, Time } from 'cosmokit'
import { Context, Fragment, Render, segment, Session } from '@satorijs/core'
import { Computed } from './session'
import { Channel, User } from './database'

declare module '@satorijs/core' {
  interface Context {
    $internal: Internal
    component(name: string, component: Component): () => boolean
    middleware(middleware: Middleware, prepend?: boolean): () => boolean
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

export type Component = Render<Awaitable<Fragment>, Session>

export class SessionError extends Error {
  constructor(public path: string | string[], public param?: Dict) {
    super(makeArray(path)[0])
  }
}

function createLeadingRE(patterns: string[], prefix = '', suffix = '') {
  return patterns.length ? new RegExp(`^${prefix}(${patterns.map(escapeRegExp).join('|')})${suffix}`) : /$^/
}

export type Next = (next?: Next.Callback) => Promise<void | Fragment>
export type Middleware = (session: Session, next: Next) => Awaitable<void | Fragment>

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
  }
}

export namespace Internal {
  export interface Config {
    nickname?: string | string[]
    prefix?: Computed<string | string[]>
  }
}

export class Internal {
  static readonly methods = ['middleware', 'component', 'match']

  _hooks: [Context, Middleware][] = []
  _nameRE: RegExp
  _sessions: Dict<Session> = Object.create(null)
  _userCache = new SharedCache<User.Observed<any>>()
  _channelCache = new SharedCache<Channel.Observed<any>>()
  _components: Dict<Component> = Object.create(null)
  _matchers = new Set<Matcher>()

  constructor(private ctx: Context, private config: Internal.Config) {
    defineProperty(this, Context.current, ctx)
    this.prepare()

    // bind built-in event listeners
    this.middleware(this._process.bind(this), true)
    ctx.on('message', this._handleMessage.bind(this))

    ctx.before('attach-user', (session, fields) => {
      session.collect('user', session.argv, fields)
    })

    ctx.before('attach-channel', (session, fields) => {
      session.collect('channel', session.argv, fields)
    })

    this.component('execute', async (attrs, content, session) => {
      const children = await session.transform(content)
      return session.execute(children.join(''), true)
    })

    this.component('prompt', async (attrs, content, session) => {
      await session.send(content)
      return session.prompt()
    })

    this.component('i18n', async (attrs, content, session) => {
      return session.text(attrs.path)
    })

    this.component('random', async (attrs, content, session) => {
      const children = await session.transform(content)
      return Random.pick(children)
    })

    this.component('plural', async (attrs, content, session) => {
      const children = await session.transform(content)
      const path = attrs.count in children ? attrs.count : children.length - 1
      return children[path]
    })

    const units = ['day', 'hour', 'minute', 'second'] as const

    this.component('i18n:time', (attrs, content, session) => {
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
    })

    ctx.before('attach', (session) => {
      if (session.parsed.prefix) return
      for (const matcher of this._matchers) {
        this._executeMatcher(session, matcher)
        if (session.response) return
      }
    })
  }

  protected get caller() {
    return this[Context.current] as Context
  }

  middleware(middleware: Middleware, prepend = false) {
    return this.caller.lifecycle.register('middleware', this._hooks, middleware, prepend)
  }

  component(name: string, component: Component) {
    this._components[name] = component
    return this.caller.collect('component', () => {
      const shouldDelete = this._components[name] === component
      if (shouldDelete) delete this._components[name]
      return shouldDelete
    })
  }

  match(pattern: string | RegExp, response: Matcher.Response, options: Matcher.Options) {
    const matcher: Matcher = { ...options, context: this.caller, pattern, response }
    this._matchers.add(matcher)
    return this.caller.collect('shortcut', () => {
      return this._matchers.delete(matcher)
    })
  }

  private _executeMatcher(session: Session, matcher: Matcher) {
    const { parsed, quote } = session
    const { appel, context, i18n, fuzzy, pattern, response } = matcher
    if (appel && !parsed.appel) return
    if (!context.filter(session)) return
    let content = parsed.content
    if (quote) content += ' ' + quote.content

    let params: [string, ...string[]] = null
    const match = (pattern: any) => {
      if (!pattern) return
      if (typeof pattern === 'string') {
        if (!fuzzy && content !== pattern || !content.startsWith(pattern)) return
        params = [content.slice(pattern.length)]
        if (fuzzy && !parsed.appel && params[0].match(/^\S/)) {
          params = null
        }
      } else {
        params = pattern.exec(content)
      }
    }

    if (!i18n) {
      match(pattern)
    } else {
      for (const locale in this.ctx.i18n._data) {
        const store = this.ctx.i18n._data[locale]
        match(store[pattern as string])
        if (params) continue
        session.locale = locale
        break
      }
    }

    if (!params) return
    session.response = async () => {
      const output = await session.resolveValue(response, params)
      return segment.normalize(output, params.map(source => segment.parse(source)))
    }
  }

  prepare() {
    this._nameRE = createLeadingRE(makeArray(this.config.nickname), '@?', '([,，]\\s*|\\s+)')
  }

  private _resolvePrefixes(session: Session) {
    const value = session.resolveValue(this.config.prefix)
    const result = Array.isArray(value) ? value : [value || '']
    return result.map(source => segment.escape(source))
  }

  private _stripNickname(content: string) {
    if (content.startsWith('@')) content = content.slice(1)
    for (const nickname of makeArray(this.config.nickname)) {
      if (!content.startsWith(nickname)) continue
      const rest = content.slice(nickname.length)
      const capture = /^([,，]\s*|\s+)/.exec(rest)
      if (!capture) continue
      return rest.slice(capture[0].length)
    }
  }

  private async _process(session: Session, next: Next) {
    let atSelf = false, appel = false, prefix: string = null
    let content = session.content.trim()
    session.elements ??= segment.parse(content)

    // strip mentions
    let hasMention = false
    const elements = session.elements.slice()
    while (elements[0]?.type === 'at') {
      const { attrs } = elements.shift()
      if (attrs.id === session.selfId) {
        atSelf = appel = true
      }
      hasMention = true
      content = elements.join('').trimStart()
      // @ts-ignore
      if (elements[0]?.type === 'text' && !elements[0].attrs.content.trim()) {
        elements.shift()
      }
    }

    if (!hasMention || atSelf) {
      // strip nickname
      const result = this._stripNickname(content)
      if (result) {
        appel = true
        content = result
      }

      // strip prefix
      for (const _prefix of this._resolvePrefixes(session)) {
        if (!content.startsWith(_prefix)) continue
        prefix = _prefix
        content = content.slice(_prefix.length)
      }
    }

    // store parsed message
    defineProperty(session, 'parsed', { content, appel, prefix })
    this.ctx.emit(session, 'before-attach', session)

    if (this.ctx.database) {
      if (session.subtype === 'group') {
        // attach group data
        const channelFields = new Set<Channel.Field>(['flag', 'assignee', 'guildId', 'locale'])
        this.ctx.emit('before-attach-channel', session, channelFields)
        const channel = await session.observeChannel(channelFields)
        // for backwards compatibility (TODO remove in v5)
        channel.guildId = session.guildId

        // emit attach event
        if (await this.ctx.serial(session, 'attach-channel', session)) return

        // ignore some group calls
        if (channel.flag & Channel.Flag.ignore) return
        if (channel.assignee !== session.selfId && !atSelf) return
      }

      // attach user data
      // authority is for suggestion
      const userFields = new Set<User.Field>(['flag', 'authority', 'locale'])
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
    const queue: Next.Queue = this._hooks
      .filter(([context]) => context.filter(session))
      .map(([, middleware]) => middleware.bind(null, session))

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
      this._userCache.delete(session.id)
      this._channelCache.delete(session.id)

      // flush user & group data
      await session.user?.$update()
      await session.channel?.$update()
      await session.guild?.$update()
      this.ctx.emit(session, 'middleware', session)
    }
  }
}

Context.service('$internal', Internal)

export namespace SharedCache {
  export interface Entry<T> {
    value: T
    key: string
    refs: Set<string>
  }
}

export class SharedCache<T> {
  #keyMap: Dict<SharedCache.Entry<T>> = Object.create(null)

  get(ref: string, key: string) {
    const entry = this.#keyMap[key]
    if (!entry) return
    entry.refs.add(ref)
    return entry.value
  }

  set(ref: string, key: string, value: T) {
    let entry = this.#keyMap[key]
    if (entry) {
      entry.value = value
    } else {
      entry = this.#keyMap[key] = { value, key, refs: new Set() }
    }
    entry.refs.add(ref)
  }

  delete(ref: string) {
    for (const key in this.#keyMap) {
      const { refs } = this.#keyMap[key]
      refs.delete(ref)
      if (!refs.size) {
        delete this.#keyMap[key]
      }
    }
  }
}
