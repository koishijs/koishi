import { Argv } from './parser'
import { Context } from '../context'

export default function validate(ctx: Context) {
  // add user fields
  ctx.on('command-added', (cmd) => {
    cmd.userFields(({ tokens, command, options = {} }, fields) => {
      if (!command) return
      const { authority } = command.config
      let shouldFetchAuthority = authority > 0
      for (const { name, authority } of Object.values(command._options)) {
        if (name in options) {
          if (authority > 0) shouldFetchAuthority = true
        } else if (tokens) {
          if (authority > 0) shouldFetchAuthority = true
        }
      }
      if (shouldFetchAuthority) fields.add('authority')
    })
  })

  // check user
  ctx.before('command/execute', (argv: Argv<'authority'>) => {
    const { session, options, command } = argv
    if (!session.user) return

    function sendHint(message: string, ...param: any[]) {
      return command.config.showWarning ? session.text(message, param) : ''
    }

    // check authority
    if (typeof session.user.authority === 'number') {
      const authority = command.getConfig('authority', session)
      if (authority > session.user.authority) {
        return sendHint('internal.low-authority')
      }
    }
    for (const option of Object.values(command._options)) {
      if (option.name in options) {
        if (option.authority > session.user.authority) {
          return sendHint('internal.low-authority')
        }
      }
    }
  }, true)

  // check argv
  ctx.before('command/execute', (argv: Argv) => {
    const { args, options, command, session } = argv
    function sendHint(message: string, ...param: any[]) {
      return command.config.showWarning ? session.text(message, param) : ''
    }

    // check argument count
    if (command.config.checkArgCount) {
      const nextArg = command._arguments[args.length] || {}
      if (nextArg.required) {
        return sendHint('internal.insufficient-arguments')
      }
      const finalArg = command._arguments[command._arguments.length - 1] || {}
      if (args.length > command._arguments.length && finalArg.type !== 'text' && !finalArg.variadic) {
        return sendHint('internal.redunant-arguments')
      }
    }

    // check unknown options
    if (command.config.checkUnknown) {
      const unknown = Object.keys(options).filter(key => !command._options[key])
      if (unknown.length) {
        return sendHint('internal.unknown-option', unknown.join(', '))
      }
    }
  }, true)
}
