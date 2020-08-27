import { format } from 'util'
import { Time } from 'koishi-utils'
import { Session } from '../session'
import { User } from '../database'
import { Command, CommandArgument, ParsedArgv } from '../command'
import { App } from '../app'
import { Message } from './message'

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

Command.userFields(({ command, options = {} }, fields) => {
  const { maxUsage, minInterval, authority } = command.config
  let shouldFetchAuthority = !fields.has('authority') && authority > 0
  let shouldFetchUsage = !!(maxUsage || minInterval)
  for (const { name, authority, notUsage } of Object.values(command._options)) {
    if (name in options) {
      if (authority > 0) shouldFetchAuthority = true
      if (notUsage) shouldFetchUsage = false
    }
  }
  if (shouldFetchAuthority) fields.add('authority')
  if (shouldFetchUsage) {
    if (maxUsage) fields.add('usage')
    if (minInterval) fields.add('timers')
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
    function sendHint(message: string, ...param: any[]) {
      return command.config.showWarning ? format(message, ...param) : ''
    }

    for (const checker of command._checkers) {
      const result = checker(session)
      if (result) return sendHint(result === true ? '' : result)
    }

    // check argument count
    if (command.config.checkArgCount) {
      const nextArg = command._arguments[args.length] || {} as CommandArgument
      if (nextArg.required) {
        return sendHint(Message.INSUFFICIENT_ARGUMENTS)
      }
      const finalArg = command._arguments[command._arguments.length - 1] || {} as CommandArgument
      if (args.length > command._arguments.length && !finalArg.greedy && !finalArg.variadic) {
        return sendHint(Message.REDUNANT_ARGUMENTS)
      }
    }

    // check unknown options
    if (command.config.checkUnknown) {
      const unknown = Object.keys(options).filter(key => !command._options[key])
      if (unknown.length) {
        return sendHint(Message.UNKNOWN_OPTIONS, unknown.join(', '))
      }
    }

    for (const { validate, name } of Object.values(command._options)) {
      if (!validate || !(name in options)) continue
      const result = typeof validate !== 'function'
        ? !validate.test(options[name])
        : validate(options[name])
      if (result) {
        return sendHint(Message.INVALID_OPTION, name, result === true ? Message.CHECK_SYNTAX : result)
      }
    }

    if (!session.$user) return
    let isUsage = true

    // check authority
    if (command.config.authority > session.$user.authority) {
      return sendHint(Message.LOW_AUTHORITY)
    }
    for (const option of Object.values(command._options)) {
      if (option.name in options) {
        if (option.authority > session.$user.authority) {
          return sendHint(Message.LOW_AUTHORITY)
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
        return sendHint(Message.USAGE_EXHAUSTED)
      }

      if (minInterval > 0 && checkTimer(name, session.$user, minInterval)) {
        return sendHint(Message.TOO_FREQUENT)
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

export function checkTimer(name: string, { timers }: Pick<User, 'timers'>, offset?: number) {
  const now = Date.now()
  if (!(now <= timers.$date)) {
    for (const key in timers) {
      if (now > timers[key]) delete timers[key]
    }
    timers.$date = now + Time.day
  }
  if (now <= timers[name]) return true
  if (offset !== undefined) {
    timers[name] = now + offset
  }
}
