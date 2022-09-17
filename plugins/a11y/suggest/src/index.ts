import { distance } from 'fastest-levenshtein'
import { Awaitable, Context, Next, Schema, Session } from 'koishi'
import zh from './locales/zh.yml'
import en from './locales/en.yml'
import ja from './locales/ja.yml'
import fr from './locales/fr.yml'
import zhTW from './locales/zh-tw.yml'

declare module 'koishi' {
  interface Context {
    $suggest: SuggestionService
  }

  interface Session {
    suggest(options: SuggestOptions): Promise<void>
  }
}

Context.service('$suggest')

export interface SuggestOptions {
  target: string
  items: string[]
  next?: Next
  prefix?: string
  suffix: string
  minSimilarity?: number
  apply: (this: Session, suggestion: string, next: Next) => Awaitable<void | string>
}

Session.prototype.suggest = function suggest(this: Session, options) {
  const {
    target,
    items,
    prefix = '',
    suffix,
    apply,
    next = Next.compose,
    minSimilarity = this.app.$suggest.config.minSimilarity,
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

class SuggestionService {
  constructor(public ctx: Context, public config: SuggestionService.Config) {
    ctx.$suggest = this

    ctx.i18n.define('zh', zh)
    ctx.i18n.define('en', en)
    ctx.i18n.define('ja', ja)
    ctx.i18n.define('fr', fr)
    ctx.i18n.define('zh-tw', zhTW)

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
        items: this.getCommandNames(session),
        prefix: session.text('suggest.command-prefix'),
        suffix: session.text('suggest.command-suffix'),
        async apply(suggestion, next) {
          const newMessage = suggestion + content.slice(target.length) + (quote ? ' ' + quote.content : '')
          return this.execute(newMessage, next)
        },
      })
    })
  }

  getCommandNames(session: Session) {
    return this.ctx.$commander._commandList
      .filter(cmd => cmd.match(session) && !cmd.config.hidden)
      .flatMap(cmd => cmd._aliases)
  }
}

namespace SuggestionService {
  export interface Config {
    minSimilarity?: number
  }

  export const Config: Schema<Config> = Schema.object({
    minSimilarity: Schema.percent().default(0.4).description('用于模糊匹配的相似系数，应该是一个 0 到 1 之间的数值。数值越高，模糊匹配越严格。设置为 1 可以完全禁用模糊匹配。'),
  })
}

export default SuggestionService
