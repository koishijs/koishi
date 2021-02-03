import { Time } from 'koishi-utils'
import { User } from '../database'
import { Command } from '../command'
import { App } from '../app'
import { Argv } from '../parser'
import { Template } from '../template'

export function getUsageName(command: Command) {
  return command.config.usageName || command.name
}

export type ValidationField = 'authority' | 'usage' | 'timers'

Command.userFields(({ tokens, command, options = {} }, fields) => {
  if (!command) return
  const { maxUsage, minInterval, authority } = command.config
  let shouldFetchAuthority = authority > 0
  let shouldFetchUsage = !!(maxUsage || minInterval)
  for (const { name, authority, notUsage } of Object.values(command._options)) {
    if (name in options) {
      if (authority > 0) shouldFetchAuthority = true
      if (notUsage) shouldFetchUsage = false
    } else if (tokens) {
      if (authority > 0) shouldFetchAuthority = true
    }
  }
  if (shouldFetchAuthority) fields.add('authority')
  if (shouldFetchUsage) {
    if (maxUsage) fields.add('usage')
    if (minInterval) fields.add('timers')
  }
})

export default function apply(app: App) {
  app.before('command', async (argv: Argv<ValidationField>) => {
    const { error, session, args, options, command } = argv
    function sendHint(message: string, ...param: any[]) {
      return command.config.showWarning ? Template(message, param) : ''
    }

    if (error) return error

    for (const validator of command._checkers) {
      const result = validator.call(command, argv, ...argv.args)
      if (typeof result === 'string') return result
    }

    // check argument count
    if (command.config.checkArgCount) {
      const nextArg = command._arguments[args.length] || {}
      if (nextArg.required) {
        return sendHint('internal.insufficient-arguments')
      }
      const finalArg = command._arguments[command._arguments.length - 1] || {}
      if (args.length > command._arguments.length && finalArg.type !== 'text' && !finalArg.variadic) {
        return sendHint('internal.redunant-arguments')
      }
    }

    // check unknown options
    if (command.config.checkUnknown) {
      const unknown = Object.keys(options).filter(key => !command._options[key])
      if (unknown.length) {
        return sendHint('internal.unknown-option', unknown.join(', '))
      }
    }

    if (!session.$user) return
    let isUsage = true

    // check authority
    if (command.config.authority > session.$user.authority) {
      return sendHint('internal.low-authority')
    }
    for (const option of Object.values(command._options)) {
      if (option.name in options) {
        if (option.authority > session.$user.authority) {
          return sendHint('internal.low-authority')
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
        return sendHint('internal.usage-exhausted')
      }

      if (minInterval > 0 && checkTimer(name, session.$user, minInterval)) {
        return sendHint('internal.too-frequent')
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
  if (!user.usage) return
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
