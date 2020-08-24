import { NextFunction, Context, Middleware } from '../context'
import { Session } from '../session'
import { Message } from './message'
import { getCommands } from './help'
import { format } from 'util'
import leven from 'leven'

declare module '../session' {
  interface Session {
    $use(middleware: Middleware): () => void
    $prompt(timeout?: number): Promise<string>
    $suggest(options: SuggestOptions): void
  }
}

interface SuggestOptions {
  target: string
  items: string[]
  next?: NextFunction
  prefix?: string
  suffix: string
  coefficient?: number
  apply: (this: Session, suggestion: string, next: NextFunction) => void
}

export function getSessionId(session: Session) {
  return '' + session.userId + session.groupId
}

Session.prototype.$use = function $use(this: Session, middleware: Middleware) {
  const identifier = getSessionId(this)
  return this.$app.prependMiddleware(async (session, next) => {
    if (identifier && getSessionId(session) !== identifier) return next()
    return middleware(session, next)
  })
}

Session.prototype.$prompt = function $prompt(this: Session, timeout = this.$app.options.promptTimeout) {
  return new Promise((resolve, reject) => {
    const dispose = this.$use((session) => {
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

Session.prototype.$suggest = function $suggest(this: Session, options: SuggestOptions) {
  const {
    target,
    items,
    prefix = '',
    suffix,
    apply,
    next = callback => callback(),
    coefficient = this.$app.options.similarityCoefficient,
  } = options

  let suggestions: string[], minDistance = Infinity
  for (const name of items) {
    const distance = leven(name, target)
    if (name.length <= 2 || distance > name.length * coefficient) continue
    if (distance === minDistance) {
      suggestions.push(name)
    } else if (distance < minDistance) {
      suggestions = [name]
      minDistance = distance
    }
  }
  if (!suggestions) return next(() => this.$send(prefix))

  return next(() => {
    const message = prefix + format(Message.SUGGESTION, suggestions.map(name => `“${name}”`).join('或'))
    if (suggestions.length > 1) return this.$send(message)

    const dispose = this.$use((session, next) => {
      dispose()
      const message = session.message.trim()
      if (message && message !== '.' && message !== '。') return next()
      return apply.call(session, suggestions[0], next)
    })

    return this.$send(message + suffix)
  })
}

export default function apply(ctx: Context) {
  ctx.middleware((session, next) => {
    const { $argv, $parsed, $prefix, $appel, messageType } = session
    if ($argv || messageType !== 'private' && $prefix === null && !$appel) return next()
    const target = $parsed.split(/\s/, 1)[0].toLowerCase()
    if (!target) return next()

    const items = getCommands(session as any, ctx.app._commands).flatMap(cmd => cmd._aliases)
    return session.$suggest({
      target,
      next,
      items,
      prefix: Message.COMMAND_SUGGEST_PREFIX,
      suffix: Message.COMMAND_SUGGEST_SUFFIX,
      async apply(suggestion, next) {
        const newMessage = suggestion + $parsed.slice(target.length)
        return this.$execute(newMessage, next)
      },
    })
  })
}
