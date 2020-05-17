import { NextFunction, Meta, onApp } from '..'
import { messages } from '../shared'
import { format } from 'util'
import leven from 'leven'

onApp((app) => {
  app.middleware((meta, next) => {
    if (meta.$argv) return next()
    const { message, prefix, nickname } = meta.$parsed
    const target = meta.$parsed.message.split(/\s/, 1)[0].toLowerCase()
    if (!target || !(prefix !== null || nickname || meta.messageType === 'private')) return next()

    const items = Object.keys(app._commandMap)
      .filter(name => app._commandMap[name].context.match(meta))

    return showSuggestions({
      target,
      meta,
      next,
      items,
      prefix: messages.COMMAND_SUGGESTION_PREFIX,
      suffix: messages.COMMAND_SUGGESTION_SUFFIX,
      coefficient: app.options.similarityCoefficient,
      async execute (suggestion, meta, next) {
        const newMessage = suggestion + message.slice(target.length)
        return app.executeCommandLine(newMessage, meta, next)
      },
    })
  })
})

interface SuggestOptions {
  target: string
  items: string[]
  meta: Meta<'message'>
  next: NextFunction
  prefix: string
  suffix: string
  coefficient?: number
  execute: (suggestion: string, meta: Meta<'message'>, next: NextFunction) => any
}

export function showSuggestions (options: SuggestOptions): Promise<void> {
  const { target, items, meta, next, prefix, suffix, execute, coefficient = 0.4 } = options
  const suggestions = items.filter((name) => {
    return name.length > 2 && leven(name, target) <= name.length * coefficient
  })
  if (!suggestions.length) return next()

  return next(() => {
    const message = prefix + format(messages.SUGGESTION_TEXT, suggestions.map(name => `“${name}”`).join('或'))
    if (suggestions.length > 1) return meta.$send(message)

    meta.$app.onceMiddleware(async (meta, next) => {
      const message = meta.message.trim()
      if (message && message !== '.' && message !== '。') return next()
      return execute(suggestions[0], meta, next)
    }, meta)
    return meta.$send(message + suffix)
  })
}
