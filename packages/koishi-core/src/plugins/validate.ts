import { format } from 'util'
import { getDateNumber, hyphenate } from 'koishi-utils'
import { Meta } from '../meta'
import { User } from '../database'
import { Command, ParsedCommandLine } from '../command'
import { App } from '../app'

declare module '../context' {
  interface EventMap {
    'usage-exhausted' (meta: Meta): void
  }
}

export type UserType <T, U extends User.Field = User.Field> = T | ((user: Pick<User, U>) => T)

declare module '../command' {
  interface Command <U, G> {
    _checkers: ((meta: Meta<U, G>) => string | boolean)[]
    before (checker: (meta: Meta<U, G>) => string | boolean): this
    getConfig <K extends keyof CommandConfig> (key: K, meta: Meta): Exclude<CommandConfig[K], (user: User) => any>
  }

  interface CommandConfig <U, G> {
    /** disallow unknown options */
    checkUnknown?: boolean
    /** check required options */
    checkRequired?: boolean
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
}

export function getUsageName (command: Command) {
  return command.config.usageName || command.name
}

export type ValidationField = 'authority' | 'usage' | 'timers'

Object.assign(Command.defaultConfig, {
  showWarning: true,
  maxUsage: Infinity,
  minInterval: 0,
})

Command.userFields(function* ({ command, options = {} }, fields) {
  const { maxUsage, minInterval, authority } = command.config
  let shouldFetchAuthority = !fields.has('authority') && authority > 0
  let shouldFetchUsage = !!(maxUsage || minInterval)
  for (const option of command._options) {
    if (option.camels[0] in options) {
      if (option.authority > 0) shouldFetchAuthority = true
      if (option.notUsage) shouldFetchUsage = false
    }
  }
  if (shouldFetchAuthority) yield 'authority'
  if (shouldFetchUsage) {
    if (maxUsage) yield 'usage'
    if (minInterval) yield 'timers'
  }
})

Command.prototype.getConfig = function (key: string, meta: Meta) {
  const value = this.config[key]
  return typeof value === 'function' ? value(meta.$user) : value
}

Command.prototype.before = function (this: Command, checker) {
  this._checkers.push(checker)
  return this
}

export default function apply (app: App) {
  app.on('new-command', (cmd) => {
    cmd._checkers = []
  })

  app.on('before-command', ({ meta, args, options, command }: ParsedCommandLine<ValidationField>) => {
    async function sendHint (meta: Meta, message: string, ...param: any[]) {
      if (command.config.showWarning) {
        await meta.$send(format(message, ...param))
        return true
      }
    }

    for (const checker of command._checkers) {
      const result = checker(meta)
      if (result) return sendHint(meta, result === true ? '' : result)
    }

    // check argument count
    if (command.config.checkArgCount) {
      const nextArg = command._arguments[args.length]
      if (nextArg?.required) {
        return sendHint(meta, messages.INSUFFICIENT_ARGUMENTS)
      }
      const finalArg = command._arguments[command._arguments.length - 1]
      if (args.length > command._arguments.length && !finalArg.noSegment && !finalArg.variadic) {
        return sendHint(meta, messages.REDUNANT_ARGUMENTS)
      }
    }

    // check unknown options
    if (command.config.checkUnknown) {
      const unknown = Object.keys(options).map(hyphenate).filter(key => !command['_optionMap'][key])
      if (unknown.length) {
        return sendHint(meta, messages.UNKNOWN_OPTIONS, unknown.join(', '))
      }
    }

    // check required options
    if (command.config.checkRequired) {
      const absent = command._options.find((option) => {
        return option.required && !(option.longest in options)
      })
      if (absent) {
        return sendHint(meta, messages.REQUIRED_OPTIONS, absent.rawName)
      }
    }

    for (const option of command._options) {
      if (!option.validate || !(option.longest in options)) continue
      const result = typeof option.validate !== 'function'
        ? !option.validate.test(options[option.longest])
        : option.validate(options[option.longest])
      if (result) {
        return sendHint(meta, messages.INVALID_OPTION, option.rawName, result === true ? messages.CHECK_SYNTAX : result)
      }
    }

    if (!meta.$user) return
    let isUsage = true

    // check authority
    if (command.config.authority > meta.$user.authority) {
      return sendHint(meta, messages.LOW_AUTHORITY)
    }
    for (const option of command._options) {
      if (option.camels[0] in options) {
        if (option.authority > meta.$user.authority) {
          return sendHint(meta, messages.LOW_AUTHORITY)
        }
        if (option.notUsage) isUsage = false
      }
    }

    // check usage
    if (isUsage) {
      const name = getUsageName(command)
      const minInterval = command.getConfig('minInterval', meta)
      const maxUsage = command.getConfig('maxUsage', meta)

      if (maxUsage < Infinity && checkUsage(name, meta.$user, maxUsage)) {
        app.emit(meta, 'usage-exhausted', meta)
        return sendHint(meta, messages.USAGE_EXHAUSTED)
      }

      if (minInterval > 0 && checkTimer(name, meta.$user, minInterval)) {
        return sendHint(meta, messages.TOO_FREQUENT)
      }
    }
  })
}

export function getUsage (name: string, user: Pick<User, 'usage'>) {
  const $date = getDateNumber()
  if (user.usage.$date !== $date) {
    user.usage = { $date }
  }
  return user.usage[name] || 0
}

export function checkUsage (name: string, user: Pick<User, 'usage'>, maxUsage?: number) {
  const count = getUsage(name, user)
  if (count >= maxUsage) return true
  if (maxUsage) {
    user.usage[name] = count + 1
  }
}

const UPDATE_INTERVAL = 86400000

export function checkTimer (name: string, { timers }: Pick<User, 'timers'>, offset?: number) {
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
