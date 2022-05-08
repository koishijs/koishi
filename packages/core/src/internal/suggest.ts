import { distance } from 'fastest-levenshtein'
import { Awaitable } from '@koishijs/utils'
import { Context, Next } from '../context'
import { Session } from '../session'
import { getCommandNames } from './help'

export interface SuggestOptions {
  target: string
  items: string[]
  next?: Next
  prefix?: string
  suffix: string
  minSimilarity?: number
  apply: (this: Session, suggestion: string, next: Next) => Awaitable<void | string>
}

export interface SuggestConfig {
  minSimilarity?: number
}

declare module '../session' {
  interface Session {
    suggest(options: SuggestOptions): Promise<void>
  }
}

Session.prototype.suggest = function suggest(this: Session, options) {
  const {
    target,
    items,
    prefix = '',
    suffix,
    apply,
    next = Next.compose,
    minSimilarity = this.app.options.minSimilarity,
  } = options

  const sendNext = async (callback: Next) => {
    const result = await next(callback)
    if (result) await this.send(result)
  }

  let suggestions: string[], minDistance = Infinity
  for (const name of items) {
    const dist = distance(name, target)
    if (name.length <= 2 || dist > name.length * minSimilarity) continue
    if (dist === minDistance) {
      suggestions.push(name)
    } else if (dist < minDistance) {
      suggestions = [name]
      minDistance = dist
    }
  }
  if (!suggestions) return sendNext(async () => prefix)

  const scope = this.scope
  return sendNext(async () => {
    const message = prefix + this.text('suggest.hint', [suggestions.map(text => {
      return this.text('general.quote', [text])
    }).join(this.text('general.or'))])
    if (suggestions.length > 1) return message

    const dispose = this.middleware((session, next) => {
      dispose()
      const message = session.content.trim()
      if (message && message !== '.' && message !== '。') return next()
      return session.withScope(scope, () => {
        return apply.call(session, suggestions[0], next)
      })
    })

    return message + suffix
  })
}

export default function suggest(ctx: Context) {
  ctx.middleware((session, next) => {
    // use `!prefix` instead of `prefix === null` to prevent from blocking other middlewares
    // we need to make sure that the user truly has the intension to call a command
    const { argv, quote, subtype, parsed: { content, prefix, appel } } = session
    if (argv.command || subtype !== 'private' && !prefix && !appel) return next()
    const target = content.split(/\s/, 1)[0].toLowerCase()
    if (!target) return next()

    return session.suggest({
      target,
      next,
      items: getCommandNames(session),
      prefix: session.text('suggest.command-prefix'),
      suffix: session.text('suggest.command-suffix'),
      async apply(suggestion, next) {
        const newMessage = suggestion + content.slice(target.length) + (quote ? ' ' + quote.content : '')
        return this.execute(newMessage, next)
      },
    })
  })
}
