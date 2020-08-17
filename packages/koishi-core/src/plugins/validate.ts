import { format } from 'util'
import { Time } from 'koishi-utils'
import { Session } from '../session'
import { User } from '../database'
import { Command, ParsedArgv } from '../command'
import { App } from '../app'

export type UserType<T, U extends User.Field = User.Field> = T | ((user: Pick<User, U>) => T)

declare module '../command' {
  interface Command<U, G> {
    _checkers: ((session: Session<U, G>) => string | boolean)[]
    before(checker: (session: Session<U, G>) => string | boolean): this
    getConfig<K extends keyof CommandConfig>(key: K, session: Session): Exclude<CommandConfig[K], (user: User) => any>
  }

  interface OptionConfig<T> {
    authority?: number
    notUsage?: boolean
  }

  interface CommandConfig<U, G> {
    /** min authority */
    authority?: number
    /** disallow unknown options */
    checkUnknown?: boolean
    /** check argument count */
    checkArgCount?: boolean
    /** show command warnings */
    showWarning?: boolean
    /** usage identifier */
    usageName?: string
    /** max usage per day */
    maxUsage?: UserType<number>
    /** min interval */
    minInterval?: UserType<number>
  }

  interface OptionConfig {
    validate?: RegExp | ((value: any) => void | string | boolean)
  }
}

const messages = {
  LOW_AUTHORITY: '权限不足。',
  TOO_FREQUENT: '调用过于频繁，请稍后再试。',
  INSUFFICIENT_ARGUMENTS: '缺少参数，请检查指令语法。',
  REDUNANT_ARGUMENTS: '存在多余参数，请检查指令语法。',
  REQUIRED_OPTIONS: '缺少必需选项 %s，请检查指令语法。',
  INVALID_OPTION: '选项 %s 输入无效，%s',
  UNKNOWN_OPTIONS: '存在未知选项 %s，请检查指令语法。',
  CHECK_SYNTAX: '请检查指令语法。',
  SHOW_THIS_MESSAGE: '显示本信息',
  USAGE_EXHAUSTED: '调用次数已达上限。',
} as const

export function getUsageName(command: Command) {
  return command.config.usageName || command.name
}

export type ValidationField = 'authority' | 'usage' | 'timers'

Object.assign(Command.defaultConfig, {
  authority: 1,
  showWarning: true,
  maxUsage: Infinity,
  minInterval: 0,
})

Object.assign(Command.defaultOptionConfig, {
  authority: 0,
})

Command.userFields(function* ({ command, options = {} }, fields) {
  const { maxUsage, minInterval, authority } = command.config
  let shouldFetchAuthority = !fields.has('authority') && authority > 0
  let shouldFetchUsage = !!(maxUsage || minInterval)
  for (const { name, authority, notUsage } of Object.values(command._options)) {
    if (name in options) {
      if (authority > 0) shouldFetchAuthority = true
      if (notUsage) shouldFetchUsage = false
    }
  }
  if (shouldFetchAuthority) yield 'authority'
  if (shouldFetchUsage) {
    if (maxUsage) yield 'usage'
    if (minInterval) yield 'timers'
  }
})

Command.prototype.getConfig = function (key: string, session: Session) {
  const value = this.config[key]
  return typeof value === 'function' ? value(session.$user) : value
}

Command.prototype.before = function (this: Command, checker) {
  this._checkers.push(checker)
  return this
}

export default function apply(app: App) {
  app.on('new-command', (cmd) => {
    cmd._checkers = []
  })

  app.on('before-command', ({ session, args, options, command }: ParsedArgv<ValidationField>) => {
    async function sendHint(session: Session, message: string, ...param: any[]) {
      if (command.config.showWarning) {
        await session.$send(format(message, ...param))
        return true
      }
    }

    for (const checker of command._checkers) {
      const result = checker(session)
      if (result) return sendHint(session, result === true ? '' : result)
    }

    // check argument count
    if (command.config.checkArgCount) {
      const nextArg = command._arguments[args.length]
      if (nextArg?.required) {
        return sendHint(session, messages.INSUFFICIENT_ARGUMENTS)
      }
      const finalArg = command._arguments[command._arguments.length - 1]
      if (args.length > command._arguments.length && !finalArg.greedy && !finalArg.variadic) {
        return sendHint(session, messages.REDUNANT_ARGUMENTS)
      }
    }

    // check unknown options
    if (command.config.checkUnknown) {
      const unknown = Object.keys(options).filter(key => !command._options[key])
      if (unknown.length) {
        return sendHint(session, messages.UNKNOWN_OPTIONS, unknown.join(', '))
      }
    }

    for (const { validate, name } of Object.values(command._options)) {
      if (!validate || !(name in options)) continue
      const result = typeof validate !== 'function'
        ? !validate.test(options[name])
        : validate(options[name])
      if (result) {
        return sendHint(session, messages.INVALID_OPTION, name, result === true ? messages.CHECK_SYNTAX : result)
      }
    }

    if (!session.$user) return
    let isUsage = true

    // check authority
    if (command.config.authority > session.$user.authority) {
      return sendHint(session, messages.LOW_AUTHORITY)
    }
    for (const option of Object.values(command._options)) {
      if (option.name in options) {
        if (option.authority > session.$user.authority) {
          return sendHint(session, messages.LOW_AUTHORITY)
        }
        if (option.notUsage) isUsage = false
      }
    }

    // check usage
    if (isUsage) {
      const name = getUsageName(command)
      const minInterval = command.getConfig('minInterval', session)
      const maxUsage = command.getConfig('maxUsage', session)

      if (maxUsage < Infinity && checkUsage(name, session.$user, maxUsage)) {
        return sendHint(session, messages.USAGE_EXHAUSTED)
      }

      if (minInterval > 0 && checkTimer(name, session.$user, minInterval)) {
        return sendHint(session, messages.TOO_FREQUENT)
      }
    }
  })
}

export function getUsage(name: string, user: Pick<User, 'usage'>) {
  const $date = Time.getDateNumber()
  if (user.usage.$date !== $date) {
    user.usage = { $date }
  }
  return user.usage[name] || 0
}

export function checkUsage(name: string, user: Pick<User, 'usage'>, maxUsage?: number) {
  const count = getUsage(name, user)
  if (count >= maxUsage) return true
  if (maxUsage) {
    user.usage[name] = count + 1
  }
}

const UPDATE_INTERVAL = 86400000

export function checkTimer(name: string, { timers }: Pick<User, 'timers'>, offset?: number) {
  const now = Date.now()
  if (!(now <= timers.$date)) {
    for (const key in timers) {
      if (now > timers[key]) delete timers[key]
    }
    timers.$date = now + UPDATE_INTERVAL
  }
  if (now <= timers[name]) return true
  if (offset !== undefined) {
    timers[name] = now + offset
  }
}
