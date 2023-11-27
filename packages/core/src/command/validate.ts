import { isNullable } from 'cosmokit'
import { Context } from '../context'
import { Argv } from './parser'

export default function validate(ctx: Context) {
  // check user
  ctx.before('command/execute', async (argv: Argv<'authority'>) => {
    const { session, options, command } = argv
    if (!session.user) return

    function sendHint(message: string, ...param: any[]) {
      return command.config.showWarning ? session.text(message, param) : ''
    }

    // check permissions
    const permissions = [`command.${command.name}`]
    for (const option of Object.values(command._options)) {
      if (option.name in options) {
        permissions.push(`command.${command.name}.option.${option.name}`)
      }
    }
    if (!await ctx.permissions.test(permissions, session as any)) {
      return sendHint('internal.low-authority')
    }
  }, true)

  // check argv
  ctx.before('command/execute', async (argv: Argv) => {
    const { args, options, command, session } = argv
    function sendHint(message: string, ...param: any[]) {
      return command.config.showWarning ? session.text(message, param) : ''
    }

    // check argument count
    if (command.config.checkArgCount) {
      let index = args.length
      while (command._arguments[index]?.required) {
        const decl = command._arguments[index]
        await session.send(session.text('internal.prompt-argument', [
          session.text(`commands.${command.name}.arguments.${decl.name}`),
        ]))
        const source = await session.prompt()
        if (isNullable(source)) {
          return sendHint('internal.insufficient-arguments', decl.name)
        }
        args.push(Argv.parseValue(source, 'argument', argv, decl))
        index++
      }
      const finalArg = command._arguments[command._arguments.length - 1] || {}
      if (args.length > command._arguments.length && !finalArg.variadic) {
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
