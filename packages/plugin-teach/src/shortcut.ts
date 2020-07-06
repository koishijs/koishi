import { Context, ParsedCommandLine } from 'koishi-core'
import { parseTeachArgs } from './database'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/shortcut' (argv: ParsedCommandLine): any
  }
}

export default function (ctx: Context) {
  ctx.prependMiddleware((meta, next) => {
    const capture = meta.message.match(/^#((\d+(?:\.\.\d+)?(?:,\d+(?:\.\.\d+)?)*)?|##?(\d*))(\s+|$)/)
    if (!capture) return next()

    const command = ctx.getCommand('teach', meta)
    const message = meta.message.slice(capture[0].length)
    const { options, args, unknown } = command.parse(message)
    const argv: ParsedCommandLine = { options, args, unknown, meta, command }

    if (capture[1].startsWith('#')) {
      options.search = true
      if (capture[1].startsWith('##')) {
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

    parseTeachArgs(argv)

    Object.defineProperty(meta, '$argv', {
      writable: true,
      value: argv,
    })

    return next()
  })
}
