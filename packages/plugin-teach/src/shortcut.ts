import { Context, removeBrackets, ParsedCommandLine } from 'koishi-core'
import { TeachConfig } from './utils'

export default function (ctx: Context, config: TeachConfig) {
  ctx.prependMiddleware((meta, next) => {
    const capture = meta.message.match(/^#(#{0,2}|\d+(,\d+)*)(\s+|$)/)
    if (!capture) return next()
    const command = ctx.getCommand('teach', meta)
    const message = meta.message.slice(capture[0].length)
    const { options, args, unknown } = command.parse(message)
    const argv: ParsedCommandLine = { options, args, unknown, meta, command }

    if (capture[1].startsWith('#')) {
      options.search = true
      if (capture[1].length > 1) {
        options.keyword = true
        options.autoMerge = true
      }
      if (!args.length) {
        options.info = true
      }
    } else if (capture[1]) {
      options.target = capture[1]
    } else if (!message) {
      options.help = true
    }

    function attachOption (keyword: string, key: string) {
      const option = command._optsDef[key]
      const fullname = removeBrackets(option.rawName)
      const index = args.indexOf(keyword)
      if (index >= 0) {
        const [_, value] = args.splice(index, 2)
        if (!value) return meta.$send(`选项 ${fullname} 缺少参数。`)
        for (const name of option.camels) {
          options[name] = value
        }
      }
    }

    if (attachOption('<<', 'set-pred')) return
    if (attachOption('<', 'add-pred')) return
    if (attachOption('>>', 'set-succ')) return
    if (attachOption('>', 'add-succ')) return
    if (attachOption('=>', 'redirect-dialogue')) return

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
