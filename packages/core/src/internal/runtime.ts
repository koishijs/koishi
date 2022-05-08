import { defineProperty, valueMap } from '@koishijs/utils'
import { Argv } from '../parser'
import { Context } from '../context'
import { Session } from '../session'

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

    const escape = (capture: RegExpExecArray) => (source: any) => {
      if (typeof source !== 'string') return source
      source = source.replace(/\$\$/g, '@@__PLACEHOLDER__@@')
      capture.forEach((segment, index) => {
        if (!index || index > 9) return
        source = source.replace(new RegExp(`\\$${index}`, 'g'), (segment || '').replace(/\$/g, '@@__PLACEHOLDER__@@'))
      })
      return source.replace(/@@__PLACEHOLDER__@@/g, '$')
    }

    for (const shortcut of ctx.app._shortcuts) {
      const { name, fuzzy, command, prefix, options = {}, args = [], replacement } = shortcut
      if (prefix && !parsed.appel || !command.context.match(session)) continue
      if (typeof replacement !== 'string') {
        if (typeof name === 'string') {
          if (!fuzzy && content !== name || !content.startsWith(name)) continue
          const message = content.slice(name.length)
          if (fuzzy && !parsed.appel && message.match(/^\S/)) continue
          let argv = Argv.parse(message.trim())
          argv.session = session
          argv = command.parse(argv, '', [...args], { ...options })
          argv.command = command
          return argv
        } else {
          const capture = name.exec(content)
          if (!capture) continue
          return {
            command,
            args: args.map(escape(capture)),
            options: valueMap(options, escape(capture)),
          }
        }
      } else {
        let argv: Argv
        if (typeof name === 'string') {
          if (!content.startsWith(name)) continue
          const message = content.slice(name.length)
          argv = Argv.parse(`${replacement} ${message}`.trim())
        } else {
          const capture = name.exec(content)
          if (!capture) continue
          argv = Argv.parse(escape(capture)(replacement).trim())
        }
        argv.session = session
        argv = command.parse(argv)
        argv.command = command
        return argv
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

  function executeHelp(session: Session, name: string) {
    if (!ctx.getCommand('help')) return
    return session.execute({
      name: 'help',
      args: [name],
    })
  }

  ctx.before('command/execute', (argv) => {
    const { args, command, options, session } = argv
    if (options['help'] && command._options.help) {
      return executeHelp(session, command.name)
    }

    if (command['_actions'].length) return
    const arg0 = args.shift() || ''
    const subcommand = ctx.getCommand(command.name + '.' + arg0)
    if (subcommand) {
      return session.execute({ ...argv, command: subcommand })
    } else {
      return executeHelp(session, command.name)
    }
  })
}
