import { format } from 'util'
import { Time } from 'koishi-utils'
import { User } from '../database'
import { Command } from '../command'
import { App } from '../app'
import { Message } from './message'
import { Argv } from '../parser'

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
  app.on('before-command', async ({ error, session, args, options, command }: Argv<ValidationField>) => {
    function sendHint(message: string, ...param: any[]) {
      return command.config.showWarning ? format(message, ...param) : ''
    }

    if (error) return error

    for (const checker of command._checkers) {
      if (checker(session)) return ''
    }

    // check argument count
    if (command.config.checkArgCount) {
      const nextArg = command._arguments[args.length] || {}
      if (nextArg.required) {
        return sendHint(Message.INSUFFICIENT_ARGUMENTS)
      }
      const finalArg = command._arguments[command._arguments.length - 1] || {}
      if (args.length > command._arguments.length && finalArg.type !== 'text' && !finalArg.variadic) {
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
