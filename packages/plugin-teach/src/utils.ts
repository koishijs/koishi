import { Context, ParsedCommandLine, Meta } from 'koishi-core'
import { simplify, isInteger } from 'koishi-utils'

const prefixPunctuation = /^([()\]]|\[(?!cq:))*/
const suffixPunctuation = /([.,?!()[~]|(?<!\[cq:[^\]]+)\])*$/

export function stripPunctuation (source: string) {
  source = source.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/，/g, ',')
    .replace(/、/g, ',')
    .replace(/。/g, '.')
    .replace(/？/g, '?')
    .replace(/！/g, '!')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/【/g, '[')
    .replace(/】/g, ']')
    .replace(/～/g, '~')
  return source
    .replace(prefixPunctuation, '')
    .replace(suffixPunctuation, '') || source
}

export function simplifyQuestion (source: string) {
  return simplify(stripPunctuation(String(source || '')))
}

export function simplifyAnswer (source: string) {
  return (String(source || '')).trim()
}

export function splitIds (source: string) {
  return source ? source.split(',').map(i => parseInt(i)) : []
}

export interface TeachOptions {
  ctx: Context
  meta: Meta
  args: string[]
  argc: number
  options: Record<string, any>
  writer?: number
  groups?: number[]
  envMode?: -2 | -1 | 0 | 1 | 2
}

export default async function parseOptions (ctx: Context, parsedArgv: ParsedCommandLine) {
  const { options, meta, args } = parsedArgv
  const argc = args.length

  if (typeof options.chance === 'number' && (options.chance <= 0 || options.chance > 1)) {
    await meta.$send('参数 -c, --chance 应为不超过 1 的正数。')
    return
  }

  const parsedOptions: TeachOptions = { ctx, meta, argc, args, options }

  if (options.noWriter) {
    parsedOptions.writer = 0
  } else if (options.writer) {
    if (isInteger(options.writer) && options.writer > 0) {
      parsedOptions.writer = options.writer
    } else {
      await meta.$send('参数 -w, --writer 错误，请检查指令语法。')
      return
    }
  }

  if (options.globalEnv) {
    parsedOptions.envMode = -2
    parsedOptions.groups = []
  } else if (options.noEnv) {
    parsedOptions.envMode = 2
    parsedOptions.groups = []
  } else if (typeof options.env === 'string') {
    if (options.env.match(/^(\*?(\d{9}(,\d{9})*)?|[#~]\d{9}(,\d{9})*)$/)) {
      parsedOptions.groups = splitIds(options.env.replace(/^[#~*]/, '')).sort()
      parsedOptions.envMode = options.env.startsWith('*') ? -2
        : options.env.startsWith('#') ? 1
          : options.env.startsWith('~') ? -1
            : 2
    } else {
      await meta.$send('参数 -e, --env 错误，请检查指令语法。')
      return
    }
  }

  if (String(options.question).includes('[CQ:image,')) {
    await meta.$send('问题不能包含图片。')
    return
  }

  options.question = simplifyQuestion(options.question)
  if (!options.question) delete options.question
  options.answer = simplifyAnswer(options.answer)
  if (!options.answer) delete options.answer

  return parsedOptions
}
