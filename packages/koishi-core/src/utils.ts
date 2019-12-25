import { isInteger } from 'koishi-utils'
import { NextFunction, Middleware } from './context'
import { Command } from './command'
import { MessageMeta } from './meta'
import leven from 'leven'

export function getSenderName (meta: MessageMeta) {
  if (!meta.sender || meta.$user && meta.$user.name !== String(meta.userId)) return meta.$user.name
  return meta.sender.card || meta.sender.nickname
}

export function getTargetId (target: string) {
  if (!target) return
  let qq = +target
  if (!qq) {
    const capture = /\[CQ:at,qq=(\d+)\]/.exec(target)
    if (capture) qq = +capture[1]
  }
  if (!isInteger(qq)) return
  return qq
}

interface SuggestOptions {
  target: string
  items: string[]
  meta: MessageMeta
  next: NextFunction
  prefix: string
  suffix: string
  coefficient?: number
  command: Command | ((suggestion: string) => Command)
  execute: (suggestion: string, meta: MessageMeta, next: NextFunction) => any
}

const SIMILARITY_COEFFICIENT = 0.4

function findSimilar (target: string, coefficient = SIMILARITY_COEFFICIENT) {
  return (name: string) => name.length > 2 && leven(name, target) <= name.length * coefficient
}

export function showSuggestions (options: SuggestOptions): Promise<void> {
  const { target, items, meta, next, prefix, suffix, execute, coefficient } = options
  const suggestions = items.filter(findSimilar(target, coefficient))
  if (!suggestions.length) return next()

  return next(async () => {
    let message = `${prefix}你要找的是不是${suggestions.map(name => `“${name}”`).join('或')}？`
    if (suggestions.length === 1) {
      const [suggestion] = suggestions
      const command = typeof options.command === 'function'
        ? options.command(suggestion)
        : options.command
      const identifier = meta.userId + meta.$ctxType + meta.$ctxId
      const fields = Array.from(command._userFields)
      if (!fields.includes('name')) fields.push('name')
      if (!fields.includes('usage')) fields.push('usage')
      if (!fields.includes('authority')) fields.push('authority')

      const middleware: Middleware = async (meta, next) => {
        if (meta.userId + meta.$ctxType + meta.$ctxId !== identifier) return next()
        command.context.removeMiddleware(middleware)
        if (!meta.message.trim()) {
          meta.$user = await command.context.database?.observeUser(meta.userId, 0, fields)
          return execute(suggestions[0], meta, next)
        } else {
          return next()
        }
      }
      command.context.premiddleware(middleware)
      message += suffix
    }
    await meta.$send(message)
  })
}
