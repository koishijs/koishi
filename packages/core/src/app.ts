import { Awaitable, coerce, defineProperty, Dict, escapeRegExp, Logger, makeArray, Time } from '@koishijs/utils'
import { Context, Next, Plugin } from './context'
import { Adapter } from './adapter'
import { Channel, User } from './database'
import { Command } from './command'
import { Computed, Session } from './session'
import { KoishiError } from './error'
import { Model } from './orm'
import { Template } from './i18n'
import runtime from './internal/runtime'
import validate from './internal/validate'
import suggest, { SuggestConfig } from './internal/suggest'
import help, { HelpConfig } from './internal/help'
import Schema from 'schemastery'

function createLeadingRE(patterns: string[], prefix = '', suffix = '') {
  return patterns.length ? new RegExp(`^${prefix}(${patterns.map(escapeRegExp).join('|')})${suffix}`) : /$^/
}

interface CommandMap extends Map<string, Command> {
  resolve(key: string): Command
}

const logger = new Logger('app')

export class App extends Context {
  _commandList: Command[] = []
  _commands: CommandMap = new Map<string, Command>() as never
  _shortcuts: Command.Shortcut[] = []
  _tasks = new TaskQueue()
  _hooks: Record<keyof any, [Context, (...args: any[]) => any][]> = {}
  _sessions: Dict<Session> = Object.create(null)
  _userCache = new SharedCache<User.Observed<any>>()
  _channelCache = new SharedCache<Channel.Observed<any>>()

  public app = this
  public options: App.Config
  public isActive = false
  public registry = new Plugin.Registry()

  private _nameRE: RegExp

  constructor(options: App.Config = {}) {
    super(() => true)
    this.options = new App.Config(options)
    this.registry.set(null, {
      id: '',
      using: [],
      children: [],
      disposables: [],
    })

    this.model = new Model(this)
    this.i18n = new Template(this)
    this.bots = new Adapter.BotList(this)

    this._commands.resolve = (key) => {
      if (!key) return
      const segments = key.split('.')
      let i = 1, name = segments[0], cmd: Command
      while ((cmd = this.getCommand(name)) && i < segments.length) {
        name = cmd.name + '.' + segments[i++]
      }
      return cmd
    }

    this.prepare()

    // bind built-in event listeners
    this.middleware(this._process.bind(this))
    this.on('message', this._handleMessage.bind(this))

    this.before('attach-user', (session, fields) => {
      session.collect('user', session.argv, fields)
    })

    this.before('attach-channel', (session, fields) => {
      session.collect('channel', session.argv, fields)
    })

    // install internal plugins
    this.plugin(runtime)
    this.plugin(validate)
    this.plugin(suggest)
    this.plugin(help, options.help)
  }

  prepare() {
    const { nickname } = this.options
    this.options.nickname = makeArray(nickname)
    this._nameRE = createLeadingRE(this.options.nickname, '@?', '([,，]\\s*|\\s+)')
  }

  async start() {
    this.isActive = true
    logger.debug('started')
    for (const callback of this.getHooks('ready')) {
      this._tasks.queue(callback())
    }
    delete this._hooks.ready
    await this._tasks.flush()
  }

  async stop() {
    this.isActive = false
    logger.debug('stopped')
    // `dispose` event is handled by ctx.disposables
    await Promise.all(this.state.disposables.map(dispose => dispose()))
  }

  private _resolvePrefixes(session: Session) {
    const temp = session.resolveValue(this.options.prefix)
    return Array.isArray(temp) ? temp : [temp || '']
  }

  private async _process(session: Session, next: Next) {
    let capture: RegExpMatchArray
    let atSelf = false, appel = false, prefix: string = null
    const pattern = /^\[CQ:(\w+)((,\w+=[^,\]]*)*)\]/
    let content = await session.preprocess()

    // strip prefix
    if (session.subtype !== 'private' && (capture = content.match(pattern)) && capture[1] === 'at' && capture[2].includes('id=' + session.selfId)) {
      atSelf = appel = true
      content = content.slice(capture[0].length).trimStart()
      // eslint-disable-next-line no-cond-assign
    } else if (capture = content.match(this._nameRE)) {
      appel = true
      content = content.slice(capture[0].length)
    }

    for (const _prefix of this._resolvePrefixes(session)) {
      if (!content.startsWith(_prefix)) continue
      prefix = _prefix
      content = content.slice(_prefix.length)
    }

    // store parsed message
    defineProperty(session, 'parsed', { content, appel, prefix })
    this.emit(session, 'before-attach', session)

    if (this.database) {
      if (session.subtype === 'group') {
        // attach group data
        const channelFields = new Set<Channel.Field>(['flag', 'assignee', 'guildId', 'locale'])
        this.emit('before-attach-channel', session, channelFields)
        const channel = await session.observeChannel(channelFields)
        // for backwards compatibility (TODO remove in v5)
        channel.guildId = session.guildId

        // emit attach event
        if (await this.serial(session, 'attach-channel', session)) return

        // ignore some group calls
        if (channel.flag & Channel.Flag.ignore) return
        if (channel.assignee !== session.selfId && !atSelf) return
      }

      // attach user data
      // authority is for suggestion
      const userFields = new Set<User.Field>(['flag', 'authority'])
      this.emit('before-attach-user', session, userFields)
      const user = await session.observeUser(userFields)

      // emit attach event
      if (await this.serial(session, 'attach-user', session)) return

      // ignore some user calls
      if (user.flag & User.Flag.ignore) return
    }

    this.emit(session, 'attach', session)
    return next()
  }

  private async _handleMessage(session: Session) {
    // preparation
    this._sessions[session.id] = session
    const queue: Next.Queue = this._hooks[Context.middleware]
      .filter(([context]) => context.match(session))
      .map(([, middleware]) => middleware.bind(null, session))

    // execute middlewares
    let index = 0, midStack = '', lastCall = ''
    const { prettyErrors } = this.options
    const next: Next = async (callback) => {
      if (prettyErrors) {
        lastCall = new Error().stack.split('\n', 3)[2]
        if (index) {
          const capture = lastCall.match(/\((.+)\)/)
          midStack = `\n  - ${capture ? capture[1] : lastCall.slice(7)}${midStack}`
        }
      }

      try {
        if (!this._sessions[session.id]) {
          throw new Error('isolated next function detected')
        }
        if (callback !== undefined) {
          queue.push(next => Next.compose(callback, next))
          if (queue.length > Next.MAX_DEPTH) {
            throw new KoishiError(`middleware stack exceeded ${Next.MAX_DEPTH}`, 'runtime.max-depth-exceeded')
          }
        }
        return await queue[index++]?.(next)
      } catch (error) {
        let stack = coerce(error)
        if (prettyErrors) {
          const index = stack.indexOf(lastCall)
          if (index >= 0) {
            stack = stack.slice(0, index)
          } else {
            stack += '\n'
          }
          stack += `Middleware stack:${midStack}`
        }
        this.logger('session').warn(`${session.content}\n${stack}`)
      }
    }

    try {
      const result = await next()
      if (result) await session.send(result)
    } finally {
      // update session map
      delete this._sessions[session.id]
      this.emit(session, 'middleware', session)

      // flush user & group data
      this._userCache.delete(session.id)
      this._channelCache.delete(session.id)
      await session.user?.$update()
      await session.channel?.$update()
      await session.guild?.$update()
    }
  }
}

export namespace App {
  export interface DelayConfig {
    character?: number
    message?: number
    cancel?: number
    broadcast?: number
    prompt?: number
  }

  export interface Config extends Config.Basic, Config.Features, Config.Advanced {}

  export namespace Config {
    export interface Basic extends SuggestConfig {
      locale?: string
      prefix?: Computed<string | string[]>
      nickname?: string | string[]
      autoAssign?: Computed<Awaitable<boolean>>
      autoAuthorize?: Computed<Awaitable<number>>
    }

    export interface Features {
      help?: false | HelpConfig
      delay?: DelayConfig
    }

    export interface Advanced {
      maxListeners?: number
      prettyErrors?: boolean
    }

    export interface Static extends Schema<Config> {
      Basic: Schema<Basic>
      Features: Schema<Features>
      Advanced: Schema<Advanced>
    }
  }

  export const Config = Schema.intersect([]) as Config.Static

  defineProperty(Config, 'Basic', Schema.object({
    locale: Schema.string().default('zh').description('默认使用的语言。'),
    prefix: Schema.union([
      Schema.array(String),
      Schema.transform(String, (prefix) => [prefix]),
    ] as const).default(['']).description('指令前缀字符，可以是字符串或字符串数组。将用于指令前缀的匹配。'),
    nickname: Schema.union([
      Schema.array(String),
      Schema.transform(String, (nickname) => [nickname]),
    ] as const).description('机器人的昵称，可以是字符串或字符串数组。将用于指令前缀的匹配。'),
    autoAssign: Schema.union([Boolean, Function]).default(true).description('当获取不到频道数据时，是否使用接受者作为代理者。'),
    autoAuthorize: Schema.union([Schema.natural(), Function]).default(1).description('当获取不到用户数据时默认使用的权限等级。'),
    minSimilarity: Schema.percent().default(0.4).description('用于模糊匹配的相似系数，应该是一个 0 到 1 之间的数值。数值越高，模糊匹配越严格。设置为 1 可以完全禁用模糊匹配。'),
  }).description('基础设置'))

  defineProperty(Config, 'Features', Schema.object({
    delay: Schema.object({
      character: Schema.natural().role('ms').default(0).description('调用 `session.sendQueued()` 时消息间发送的最小延迟，按前一条消息的字数计算。'),
      message: Schema.natural().role('ms').default(0.1 * Time.second).description('调用 `session.sendQueued()` 时消息间发送的最小延迟，按固定值计算。'),
      cancel: Schema.natural().role('ms').default(0).description('调用 `session.cancelQueued()` 时默认的延迟。'),
      broadcast: Schema.natural().role('ms').default(0.5 * Time.second).description('调用 `bot.broadcast()` 时默认的延迟。'),
      prompt: Schema.natural().role('ms').default(Time.minute).description('调用 `session.prompt()` 时默认的等待时间。'),
    }),
  }).description('消息设置'))

  defineProperty(Config, 'Advanced', Schema.object({
    prettyErrors: Schema.boolean().default(true).description('启用报错优化模式。在此模式下 Koishi 会对程序抛出的异常进行整理，过滤掉框架内部的调用记录，输出更易读的提示信息。'),
    maxListeners: Schema.natural().default(64).description('每种监听器的最大数量。如果超过这个数量，Koishi 会认定为发生了内存泄漏，将产生一个警告。'),
  }).description('高级设置'))

  Config.list.push(Config.Basic, Config.Features, Config.Advanced)
}

export function defineConfig(config: App.Config) {
  return config
}

class TaskQueue {
  #internal = new Set<Promise<void>>()

  queue(value: any) {
    const task = Promise.resolve(value)
      .catch(err => logger.warn(err))
      .then(() => this.#internal.delete(task))
    this.#internal.add(task)
  }

  async flush() {
    while (this.#internal.size) {
      await Promise.all(Array.from(this.#internal))
    }
  }
}

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
    const entry = this.#keyMap[key] ||= { value, key, refs: new Set() }
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
