import { App } from '../app'
import { NextFunction } from '../context'
import { Session } from '../session'
import leven from 'leven'

export default function apply (app: App) {
  app.middleware((session, next) => {
    if (session.$argv) return next()
    const { message, prefix, nickname } = session.$parsed
    const target = session.$parsed.message.split(/\s/, 1)[0].toLowerCase()
    if (!target || !(prefix !== null || nickname || session.messageType === 'private')) return next()

    const items = Object.keys(app._commandMap)
      .filter(name => app._commandMap[name].context.match(session))

    return showSuggestions({
      target,
      session,
      next,
      items,
      prefix: '没有此命令。',
      suffix: '发送空行或句号以调用推测的指令。',
      coefficient: app.options.similarityCoefficient,
      async execute (suggestion, session, next) {
        const newMessage = suggestion + message.slice(target.length)
        return app.execute(newMessage, session, next)
      },
    })
  })
}

interface SuggestOptions {
  target: string
  items: string[]
  session: Session
  next: NextFunction
  prefix: string
  suffix: string
  coefficient?: number
  execute: (suggestion: string, session: Session, next: NextFunction) => any
}

export function showSuggestions (options: SuggestOptions): Promise<void> {
  const { target, items, session, next, prefix, suffix, execute, coefficient = 0.4 } = options
  const suggestions = items.filter((name) => {
    return name.length > 2 && leven(name, target) <= name.length * coefficient
  })
  if (!suggestions.length) return next()

  return next(() => {
    const message = prefix + `你要找的是不是${suggestions.map(name => `“${name}”`).join('或')}？`
    if (suggestions.length > 1) return session.$send(message)

    session.$app.onceMiddleware(async (session, next) => {
      const message = session.message.trim()
      if (message && message !== '.' && message !== '。') return next()
      return execute(suggestions[0], session, next)
    }, session)
    return session.$send(message + suffix)
  })
}
