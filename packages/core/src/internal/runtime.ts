import { defineProperty, template, valueMap } from '@koishijs/utils'
import { Argv } from '../parser'
import { Context } from '../context'
import { getCommandNames } from './help'

export default function runtime(ctx: Context) {
  ctx.before('parse', (content, session) => {
    const argv = Argv.parse(content)
    if (session.quote) {
      argv.tokens.push({
        content: session.quote.content,
        quoted: true,
        inters: [],
        terminator: '',
      })
    }
    return argv
  })

  ctx.before('parse', (content, session) => {
    const { parsed, quote } = session
    if (parsed.prefix || quote) return
    for (const shortcut of ctx.app._shortcuts) {
      const { name, fuzzy, command, prefix, options = {}, args = [] } = shortcut
      if (prefix && !parsed.appel || !command.context.match(session)) continue
      if (typeof name === 'string') {
        if (!fuzzy && content !== name || !content.startsWith(name)) continue
        const message = content.slice(name.length)
        if (fuzzy && !parsed.appel && message.match(/^\S/)) continue
        const argv = command.parse(message.trim(), '', [...args], { ...options })
        argv.command = command
        return argv
      } else {
        const capture = name.exec(content)
        if (!capture) continue
        function escape(source: any) {
          if (typeof source !== 'string') return source
          source = source.replace(/\$\$/g, '@@__PLACEHOLDER__@@')
          capture.forEach((segment, index) => {
            if (!index || index > 9) return
            source = source.replace(new RegExp(`\\$${index}`, 'g'), (segment || '').replace(/\$/g, '@@__PLACEHOLDER__@@'))
          })
          return source.replace(/@@__PLACEHOLDER__@@/g, '$')
        }
        return {
          command,
          args: args.map(escape),
          options: valueMap(options, escape),
        }
      }
    }
  })

  ctx.before('attach', (session) => {
    defineProperty(session, 'argv', ctx.bail('before-parse', session.parsed.content, session))
    session.argv.root = true
    session.argv.session = session
  })

  ctx.middleware((session, next) => {
    // execute command
    if (!session.resolve(session.argv)) return next()
    return session.execute(session.argv, next)
  })

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
      prefix: template('internal.command-suggestion-prefix'),
      suffix: template('internal.command-suggestion-suffix'),
      async apply(suggestion, next) {
        const newMessage = suggestion + content.slice(target.length) + (quote ? ' ' + quote.content : '')
        return this.execute(newMessage, next)
      },
    })
  })
}
