import { Context, removeBrackets } from 'koishi'
import { TeachConfig } from './utils'

export default function (ctx: Context, config: TeachConfig) {
  ctx.prependMiddleware((meta, next) => {
    const capture = meta.message.match(/^#(#{0,2}|\d+(,\d+)*)(\s+|$)/)
    if (!capture) return next()
    const command = ctx.getCommand('teach', meta)
    const message = meta.message.slice(capture[0].length)
    const { options, args, unknown } = command.parse(message)

    if (capture[1].startsWith('#')) {
      options.search = true
      if (capture[1].length > 1) {
        options.keyword = true
        options.global = true
        options.autoMerge = true
      }
      if (!args.length) {
        options.info = true
      }
    } else if (capture[1]) {
      options.target = capture[1]
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

    attachOption('<<', 'set-pred')
    attachOption('<', 'add-pred')
    attachOption('>>', 'set-succ')
    attachOption('>', 'add-succ')

    if (args.length) {
      const [question] = args.splice(0, 1)
      if (question && question !== '~') {
        options.question = question
      }
    }

    if (args.length) {
      const [answer] = args.splice(0, 1)
      if (answer && answer !== '~') {
        options.answer = answer
      }
    }

    Object.defineProperty(meta, '$argv', {
      value: { options, args, unknown, meta, command },
    })
    return next()
  })
}
