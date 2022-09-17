import { defineProperty, valueMap } from '@koishijs/utils'
import { Argv } from './parser'
import { Context } from '../context'

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
    for (const shortcut of ctx.$commander._shortcuts) {
      const { name, fuzzy, command, prefix, options = {}, args = [] } = shortcut
      if (prefix && !parsed.appel || !command.ctx.filter(session)) continue
      if (typeof name === 'string') {
        if (!fuzzy && content !== name || !content.startsWith(name)) continue
        const message = content.slice(name.length)
        if (fuzzy && !parsed.appel && message.match(/^\S/)) continue
        const argv = Argv.parse(message.trim())
        argv.session = session
        return command.parse(argv, '', [...args], { ...options })
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
        return command.parse({
          args: args.map(escape),
          options: valueMap(options, escape),
        })
      }
    }
  })

  ctx.before('attach', (session) => {
    defineProperty(session, 'argv', ctx.bail('before-parse', session.parsed.content, session))
    session.argv.root = true
    session.argv.session = session
  })
}
