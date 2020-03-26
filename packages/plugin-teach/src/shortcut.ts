import { Context, removeBrackets, ParsedCommandLine } from 'koishi-core'
import { TeachConfig } from './utils'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/shortcut' (argv: ParsedCommandLine): any
  }
}

export default function (ctx: Context, config: TeachConfig) {
  ctx.prependMiddleware((meta, next) => {
    const capture = meta.message.match(/^#((\d+(?:,\d+)*)?|##?(\d*))(\s+|$)/)
    if (!capture) return next()

    const command = ctx.getCommand('teach', meta)
    const message = meta.message.slice(capture[0].length)
    const { options, args, unknown } = command.parse(message)
    const argv: ParsedCommandLine = { options, args, unknown, meta, command }

    if (capture[1].startsWith('#')) {
      options.search = true
      if (capture[1].startsWith('##')) {
        options.keyword = true
        options.autoMerge = true
      }
      if (capture[3]) {
        options.page = +capture[3]
      }
    } else if (capture[1]) {
      options.target = capture[1]
    } else if (!message) {
      options.help = true
    }

    const result = ctx.bail('dialogue/shortcut', argv)
    if (result) return result

    function parseArgument () {
      if (!args.length) return
      const [arg] = args.splice(0, 1)
      if (!arg || arg === '~') return
      return arg
    }

    options.question = parseArgument()
    options.answer = options.redirectDialogue || parseArgument()

    Object.defineProperty(meta, '$argv', {
      writable: true,
      value: argv,
    })

    return next()
  })
}
