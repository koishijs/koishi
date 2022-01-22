import { Awaitable, defineProperty, Time, coerce, escapeRegExp, makeArray, trimSlash, merge, Dict } from '@koishijs/utils'
import { Context, Next, Plugin } from './context'
import { Adapter } from './adapter'
import { Channel, User } from './database'
import { Command } from './command'
import { Session, Computed } from './session'
import { KoishiError } from './error'
import { Model } from './orm'
import runtime from './internal/runtime'
import validate from './internal/validate'
import help, { HelpConfig } from './internal/help'
import Schema from 'schemastery'

function createLeadingRE(patterns: string[], prefix = '', suffix = '') {
  return patterns.length ? new RegExp(`^${prefix}(${patterns.map(escapeRegExp).join('|')})${suffix}`) : /$^/
}

interface CommandMap extends Map<string, Command> {
  resolve(key: string): Command
}

export class App extends Context {
  _commandList: Command[] = []
  _commands: CommandMap = new Map<string, Command>() as never
  _shortcuts: Command.Shortcut[] = []
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
    this.bots = new Adapter.BotList(this)

    this._commands.resolve = (key) => {
      if (!key) return
      const segments = key.split('.')
      let i = 1, name = segments[0], cmd: Command
      while ((cmd = this._commands.get(name)) && i < segments.length) {
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
    this.plugin(help, options.help)
  }

  prepare() {
    const { nickname } = this.options
    this.options.nickname = makeArray(nickname)
    this._nameRE = createLeadingRE(this.options.nickname, '@?', '([,，]\\s*|\\s+)')
  }

  async start() {
    this.isActive = true
    await this.parallel('ready')
    this.logger('app').debug('started')
  }

  async stop() {
    this.isActive = false
    // `disconnect` event is handled by ctx.disposables
    await Promise.all(this.state.disposables.map(dispose => dispose()))
    this.logger('app').debug('stopped')
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
        const channelFields = new Set<Channel.Field>(['flag', 'assignee'])
        this.emit('before-attach-channel', session, channelFields)
        const channel = await session.observeChannel(channelFields)

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

  export interface Config {
    prefix?: Computed<string | string[]>
    nickname?: string | string[]
    maxListeners?: number
    prettyErrors?: boolean
    delay?: DelayConfig
    help?: boolean | HelpConfig
    autoAssign?: Computed<Awaitable<boolean>>
    autoAuthorize?: Computed<Awaitable<number>>
    minSimilarity?: number
  }

  export namespace Config {
    export interface Static extends Schema<Config> {}
  }

  const BasicConfig = Schema.object({
    prefix: Schema.string().description('指令前缀字符，可以是字符串或字符串数组。将用于指令前缀的匹配。例如，如果配置该选项为 `.`，则你可以通过 `.help` 来进行 help 指令的调用。'),
    nickname: Schema.union([
      Schema.array(Schema.string()),
      Schema.transform(Schema.string(), (nickname) => [nickname]),
    ]).description('机器人的昵称，可以是字符串或字符串数组。将用于指令前缀的匹配。例如，如果配置该选项为 `Koishi`，则你可以通过 `Koishi, help` 来进行 help 指令的调用。'),
    autoAuthorize: Schema.number().default(1).description('当获取不到用户数据时默认使用的权限等级。'),
    autoAssign: Schema.boolean().default(true).description('当获取不到频道数据时，是否使用接受者作为代理者。'),
    maxListeners: Schema.number().default(64).description('每种监听器的最大数量。如果超过这个数量，Koishi 会认定为发生了内存泄漏，将产生一个警告。'),
    prettyErrors: Schema.boolean().default(true).description('启用报错优化模式。在此模式下 Koishi 会对程序抛出的异常进行整理，过滤掉框架内部的调用记录，输出更易读的提示信息。'),
    minSimilarity: Schema.number().default(0.4).description('用于模糊匹配的相似系数，应该是一个 0 到 1 之间的数值。数值越高，模糊匹配越严格。设置为 1 可以完全禁用模糊匹配。'),
  }).description('基础设置')

  const AdvancedConfig = Schema.object({
    delay: Schema.object({
      character: Schema.number().default(0).description('调用 `session.sendQueued()` 是消息间发送的最小延迟，按前一条消息的字数计算'),
      message: Schema.number().default(0.1 * Time.second).description('调用 `session.sendQueued()` 时消息间发送的最小延迟，按固定值计算'),
      cancel: Schema.number().default(0).description('调用 `session.cancelQueued()` 时默认的延迟'),
      broadcast: Schema.number().default(0.5 * Time.second).description('调用 `bot.broadcast()` 时默认的延迟'),
      prompt: Schema.number().default(Time.minute).description('调用 `session.prompt()` 是默认的等待时间'),
    }),
  }).description('高级设置')

  export const Config: Config.Static = Schema.intersect([BasicConfig, AdvancedConfig])
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
  #refMap: Dict<SharedCache.Entry<T>> = Object.create(null)

  get(ref: string, key: string) {
    const entry = this.#keyMap[key]
    if (!entry) return
    this.ref(ref, entry)
    return entry.value
  }

  set(ref: string, key: string, value: T) {
    const entry = this.#keyMap[key] ||= { value, key, refs: new Set() }
    this.ref(ref, entry)
  }

  private ref(ref: string, entry: SharedCache.Entry<T>) {
    this.delete(ref)
    this.#refMap[ref] = entry
    entry.refs.add(ref)
  }

  delete(ref: string) {
    const entry = this.#refMap[ref]
    if (!entry) return
    entry.refs.delete(ref)
    if (!entry.refs.size) {
      delete this.#keyMap[entry.key]
    }
    delete this.#refMap[ref]
  }
}
