import { NextFunction, Context, Middleware } from '../context'
import { Session } from '../session'
import leven from 'leven'

declare module '../session' {
  interface Session {
    $use (middleware: Middleware, timeout?: number): () => void
    $prompt (timeout?: number): Promise<string>
    $suggest (options: SuggestOptions): void
  }
}

interface SuggestOptions {
  target: string
  items: string[]
  next?: NextFunction
  prefix?: string
  suffix: string
  coefficient?: number
  apply: (this: Session, suggestion: string, next: NextFunction) => any
}

export function getSessionId (session: Session) {
  return '' + session.userId + session.groupId
}

Session.prototype.$use = function $use (this: Session, middleware: Middleware, timeout = this.$app.options.promptTimeout) {
  const identifier = getSessionId(this)
  const _dispose = this.$app.prependMiddleware(async (session, next) => {
    if (identifier && getSessionId(session) !== identifier) return next()
    return middleware(session, next)
  })
  const timer = setTimeout(dispose, timeout)
  function dispose () {
    _dispose()
    clearTimeout(timer)
  }
  return dispose
}

Session.prototype.$prompt = function $prompt (this: Session, timeout = this.$app.options.promptTimeout) {
  return new Promise((resolve, reject) => {
    const identifier = getSessionId(this)
    const dispose = this.$app.prependMiddleware(async (session, next) => {
      if (identifier && getSessionId(session) !== identifier) return next()
      clearTimeout(timer)
      dispose()
      resolve(session.message)
    })
    const timer = setTimeout(() => {
      dispose()
      reject(new Error('prompt timeout'))
    }, timeout)
  })
}

Session.prototype.$suggest = function $suggest (this: Session, options: SuggestOptions) {
  const { target, items, next = callback => callback(), prefix = '', suffix, apply, coefficient = 0.4 } = options
  let suggestions: string[], minDistance = Infinity
  for (const name of items) {
    const distance = leven(name, target)
    if (name.length <= 2 || distance > name.length * coefficient) continue
    if (distance === minDistance) {
      suggestions.push(name)
    } else if (distance < minDistance) {
      suggestions = [name]
    }
  }
  if (!suggestions) return next(() => this.$send(prefix))

  return next(() => {
    const message = prefix + `你要找的是不是${suggestions.map(name => `“${name}”`).join('或')}？`
    if (suggestions.length > 1) return this.$send(message)

    this.$use((session, next) => {
      const message = session.message.trim()
      if (message && message !== '.' && message !== '。') return next()
      return apply.call(session, suggestions[0], next)
    })

    return this.$send(message + suffix)
  })
}

export default function apply (ctx: Context) {
  ctx.middleware((session, next) => {
    if (session.$argv) return next()
    const { message, prefix, nickname } = session.$parsed
    const target = session.$parsed.message.split(/\s/, 1)[0].toLowerCase()
    if (!target || !(prefix !== null || nickname || session.messageType === 'private')) return next()

    const items = Object.keys(ctx.app._commandMap)
      .filter(name => ctx.app._commandMap[name].context.match(session))

    return session.$suggest({
      target,
      next,
      items,
      suffix: '发送空行或句号以调用推测的指令。',
      coefficient: ctx.app.options.similarityCoefficient,
      async apply (suggestion, next) {
        const newMessage = suggestion + message.slice(target.length)
        return this.$execute(newMessage, next)
      },
    })
  })
}
