import { distance } from 'fastest-levenshtein'
import { Context, I18n, Schema, Session } from 'koishi'
import {} from '@koishijs/plugin-help'
import zhCN from './locales/zh-CN.yml'
import enUS from './locales/en-US.yml'
import jaJP from './locales/ja-JP.yml'
import frFR from './locales/fr-FR.yml'
import zhTW from './locales/zh-TW.yml'

declare module 'koishi' {
  interface Session {
    suggest(options: SuggestOptions): Promise<string>
  }

  interface CompareOptions {
    minSimilarity?: number
  }
}

export interface SuggestOptions {
  target: string
  items: Iterable<string>
  prefix?: string
  suffix: string
  minSimilarity?: number
}

const oldCompare = I18n.prototype.compare
I18n.prototype.compare = function (this: I18n, expect, actual, options) {
  const runtime = this.ctx.registry.get(apply)
  if (!runtime || !expect) return oldCompare.call(this, expect, actual, options)

  const value = 1 - distance(expect, actual) / expect.length
  const threshold = options.minSimilarity ?? runtime.config.minSimilarity
  return value >= threshold ? value : 0
}

Session.prototype.suggest = async function suggest(this: Session, options: SuggestOptions) {
  const runtime = this.app.registry.get(apply)
  if (!runtime) return

  const { target, items, prefix = '', suffix } = options
  const suggestions: string[] = []
  for (const name of items) {
    if (!name) continue
    const similarity = this.app.i18n.compare(name, target, options)
    if (similarity > 0) suggestions.push(name)
  }

  const send = async (message: string) => {
    await this.send(message)
    return null
  }
  if (!suggestions.length) return send(prefix)

  const message = prefix + this.text('suggest.hint', [suggestions.map(text => {
    return this.text('general.quote', [text])
  }).join(this.text('general.or'))])
  if (suggestions.length > 1) return send(message)

  return new Promise<string>((resolve, reject) => {
    const dispose = this.middleware((session, next) => {
      dispose()
      const message = session.content.trim()
      if (message && message !== '.' && message !== '。') return next()
      resolve(suggestions[0])
    })
    this.send(message + suffix).catch(reject)
  })
}

function getCommandNames(session: Session) {
  return session.app.$commander._commandList
    .filter(cmd => cmd.match(session))
    .flatMap(cmd => cmd._aliases)
}

export const name = 'suggest'

export interface Config {
  minSimilarity?: number
}

export const Config: Schema<Config> = Schema.object({
  minSimilarity: Schema.percent().default(0.64).description('用于模糊匹配的相似系数，应该是一个 0 到 1 之间的数值。数值越高，模糊匹配越严格。设置为 1 可以完全禁用模糊匹配。'),
})

export function apply(ctx: Context, config: Config) {
  this.define('zh', zhCN)
  this.define('en', enUS)
  this.define('ja', jaJP)
  this.define('fr', frFR)
  this.define('zh-TW', zhTW)

  ctx.on('help/search', async ({ session, args }) => {
    const name = await session.suggest({
      target: args[0],
      items: getCommandNames(session),
      prefix: session.text('commands.help.messages.not-found'),
      suffix: session.text('suggest.command-suffix'),
    })
    return ctx.$commander.getCommand(name)
  })

  ctx.middleware((session, next) => {
    // use `!prefix` instead of `prefix === null` to prevent from blocking other middlewares
    // we need to make sure that the user truly has the intension to call a command
    const { argv, quote, subtype, parsed: { content, prefix, appel } } = session
    if (argv.command || subtype !== 'private' && !prefix && !appel) return next()
    const target = content.split(/\s/, 1)[0].toLowerCase()
    if (!target) return next()

    return next(async (next) => {
      const name = await session.suggest({
        target,
        items: getCommandNames(session),
        prefix: session.text('suggest.command-prefix'),
        suffix: session.text('suggest.command-suffix'),
      })
      if (!name) return next()
      const message = name + content.slice(target.length) + (quote ? ' ' + quote.content : '')
      return session.execute(message, next)
    })
  })
}
