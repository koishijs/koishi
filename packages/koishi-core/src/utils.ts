import { isInteger, getDateNumber } from 'koishi-utils'
import { UserField, GroupField, UserData } from './database'
import { NextFunction } from './context'
import { Command } from './command'
import { Meta } from './meta'
import { messages } from './messages'
import { format } from 'util'
import leven from 'leven'

export function getTargetId (target: string | number) {
  if (typeof target !== 'string' && typeof target !== 'number') return
  let qq = +target
  if (!qq) {
    const capture = /\[CQ:at,qq=(\d+)\]/.exec(target as any)
    if (capture) qq = +capture[1]
  }
  if (!isInteger(qq)) return
  return qq
}

export function getUsage (name: string, user: Pick<UserData, 'usage'>, time = new Date()) {
  const _date = getDateNumber(time)
  if (user.usage._date !== _date) {
    user.usage = { _date } as any
  }
  if (!user.usage[name]) {
    user.usage[name] = { count: 0 }
  }
  return user.usage[name]
}

export function updateUsage (name: string, user: Pick<UserData, 'usage'>, maxUsage: number, minInterval?: number) {
  const date = new Date()
  const usage = getUsage(name, user, date)

  if (minInterval > 0) {
    const now = date.valueOf()
    if (now - usage.last <= minInterval) {
      return messages.TOO_FREQUENT
    }
    usage.last = now
  }

  if (usage.count >= maxUsage) {
    return messages.USAGE_EXHAUSTED
  } else {
    usage.count++
  }
}

interface SuggestOptions {
  target: string
  items: string[]
  meta: Meta<'message'>
  next: NextFunction
  prefix: string
  suffix: string
  coefficient?: number
  disable?: (name: string) => boolean
  command: Command | ((suggestion: string) => Command)
  execute: (suggestion: string, meta: Meta<'message'>, next: NextFunction) => any
}

export function showSuggestions (options: SuggestOptions): Promise<void> {
  const { target, items, meta, next, prefix, suffix, execute, disable, coefficient = 0.4 } = options
  const suggestions = items.filter((name) => {
    return name.length > 2
      && leven(name, target) <= name.length * coefficient
      && !disable?.(name)
  })
  if (!suggestions.length) return next()

  return next(async () => {
    let message = prefix + format(messages.SUGGESTION_TEXT, suggestions.map(name => `“${name}”`).join('或'))
    if (suggestions.length === 1) {
      const [suggestion] = suggestions
      const command = typeof options.command === 'function' ? options.command(suggestion) : options.command
      const userFields = new Set<UserField>()
      const groupFields = new Set<GroupField>()
      Command.attachUserFields(userFields, { command, meta })
      Command.attachGroupFields(groupFields, { command, meta })
      command.context.onceMiddleware(async (meta, next) => {
        if (!meta.message.trim()) {
          meta.$user = await command.context.database?.observeUser(meta.userId, Array.from(userFields))
          if (meta.messageType === 'group') {
            meta.$group = await command.context.database?.observeGroup(meta.groupId, Array.from(groupFields))
          }
          return execute(suggestions[0], meta, next)
        } else {
          return next()
        }
      }, meta)
      message += suffix
    }
    await meta.$send(message)
  })
}
