import { onApp, Meta, UserData, Command } from '..'
import { messages } from '../shared'
import { format } from 'util'
import { getDateNumber } from 'koishi-utils'

declare module '../command' {
  export interface CommandConfig {
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
}

export function getUsageName (command: Command) {
  return command.config.usageName || command.name
}

onApp((app) => {
  Object.assign(Command.defaultConfig, {
    showWarning: true,
    maxUsage: Infinity,
    minInterval: 0,
  })

  app.on('before-attach-user', (meta, fields) => {
    if (!meta.$argv) return
    const { command, options = {} } = meta.$argv
    const { maxUsage, minInterval, authority } = command.config
    let shouldFetchAuthority = !fields.has('authority') && authority > 0
    let shouldFetchUsage = !(fields.has('usage') || !maxUsage && !minInterval)
    for (const option of command._options) {
      if (option.camels[0] in options) {
        if (option.authority > 0) shouldFetchAuthority = true
        if (option.notUsage) shouldFetchUsage = false
      }
    }
    if (shouldFetchAuthority) fields.add('authority')
    if (shouldFetchUsage) fields.add('usage')
  })

  app.on('before-command', ({ meta, args, unknown, options, command }) => {
    async function sendHint (meta: Meta<'message'>, message: string, ...param: any[]) {
      if (command.config.showWarning) {
        await meta.$send(format(message, ...param))
        return true
      }
    }

    if (command.getConfig('disable', meta)) return true

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
    if (command.config.checkUnknown && unknown.length) {
      return sendHint(meta, messages.UNKNOWN_OPTIONS, unknown.join(', '))
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
      const minInterval = command.getConfig('minInterval', meta)
      const maxUsage = command.getConfig('maxUsage', meta)
  
      if (maxUsage < Infinity || minInterval > 0) {
        const message = updateUsage(getUsageName(command), meta.$user, { maxUsage, minInterval })
        if (message) return sendHint(meta, message)
      }
    }
  })
})

interface UsageOptions {
  maxUsage?: number
  minInterval?: number
  timestamp?: number
}

const ONE_DAY = 86400000

export function getUsage (name: string, user: Pick<UserData, 'usage'>, time = Date.now()) {
  const $date = getDateNumber(time)
  if (user.usage.$date !== $date) {
    const oldUsage = user.usage
    const newUsage = { $date } as any
    for (const key in oldUsage) {
      if (key === '$date') continue
      const { last } = oldUsage[key]
      if (time.valueOf() - last < ONE_DAY) {
        newUsage[key] = { last }
      }
    }
    user.usage = newUsage
  }

  return user.usage[name] || (user.usage[name] = {})
}

export function updateUsage (name: string, user: Pick<UserData, 'usage'>, options: UsageOptions = {}) {
  const now = Date.now()
  const { maxUsage = Infinity, minInterval = 0, timestamp = now } = options
  const usage = getUsage(name, user, now)

  if (now - usage.last < minInterval) {
    return messages.TOO_FREQUENT
  } else if (options.minInterval || options.timestamp) {
    usage.last = timestamp
  }

  if (usage.count >= maxUsage) {
    return messages.USAGE_EXHAUSTED
  } else if (options.maxUsage) {
    usage.count = (usage.count || 0) + 1
  }
}
