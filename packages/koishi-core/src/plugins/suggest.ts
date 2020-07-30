import { NextFunction, Meta, App } from '..'
import leven from 'leven'

export default function apply (app: App) {
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
      prefix: '没有此命令。',
      suffix: '发送空行或句号以调用推测的指令。',
      coefficient: app.options.similarityCoefficient,
      async execute (suggestion, meta, next) {
        const newMessage = suggestion + message.slice(target.length)
        return app.execute(newMessage, meta, next)
      },
    })
  })
}

interface SuggestOptions {
  target: string
  items: string[]
  meta: Meta
  next: NextFunction
  prefix: string
  suffix: string
  coefficient?: number
  execute: (suggestion: string, meta: Meta, next: NextFunction) => any
}

export function showSuggestions (options: SuggestOptions): Promise<void> {
  const { target, items, meta, next, prefix, suffix, execute, coefficient = 0.4 } = options
  const suggestions = items.filter((name) => {
    return name.length > 2 && leven(name, target) <= name.length * coefficient
  })
  if (!suggestions.length) return next()

  return next(() => {
    const message = prefix + `你要找的是不是${suggestions.map(name => `“${name}”`).join('或')}？`
    if (suggestions.length > 1) return meta.$send(message)

    meta.$app.onceMiddleware(async (meta, next) => {
      const message = meta.message.trim()
      if (message && message !== '.' && message !== '。') return next()
      return execute(suggestions[0], meta, next)
    }, meta)
    return meta.$send(message + suffix)
  })
}
