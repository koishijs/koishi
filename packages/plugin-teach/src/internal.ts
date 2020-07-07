import { Context } from 'koishi-core'
import { DialogueFlag, Dialogue } from './database'

export function simplifyAnswer (source: string) {
  return (String(source || '')).trim()
}

export default function apply (ctx: Context, config: Dialogue.Config) {
  ctx.command('teach')
    .option('--question <question>', '问题', { isString: true })
    .option('--answer <answer>', '回答', { isString: true })
    .option('-x, --regexp', '使用正则表达式匹配')
    .option('-X, --no-regexp', '取消使用正则表达式匹配')
    .option('=>, --redirect-dialogue <answer>', '重定向到其他问答')

  ctx.before('dialogue/validate', (argv) => {
    const { options, meta, args } = argv
    if (args.length) {
      return meta.$send('存在多余的参数，请检查指令语法或将含有空格或换行的问答置于一对引号内。')
    }

    if (options.noRegexp) options.regexp = false

    const { answer } = options
    if (String(options.question).includes('[CQ:image,')) {
      return meta.$send('问题不能包含图片。')
    }

    const { unprefixed, prefixed, appellative } = config._stripQuestion(options.question)
    argv.appellative = appellative
    Object.defineProperty(options, '_original', { value: prefixed })
    if (unprefixed) {
      options.original = options.question
      options.question = unprefixed
    } else {
      delete options.question
    }

    options.answer = (String(answer || '')).trim()
    if (!options.answer) delete options.answer
  })

  ctx.on('dialogue/before-fetch', ({ regexp, answer, question, original }, conditionals) => {
    const { escape } = ctx.database.mysql
    if (regexp) {
      if (answer !== undefined) conditionals.push('`answer` REGEXP ' + escape(answer))
      if (question !== undefined) conditionals.push('`question` REGEXP ' + escape(original))
    } else {
      if (answer !== undefined) conditionals.push('`answer` = ' + escape(answer))
      if (question !== undefined) {
        if (regexp === false) {
          conditionals.push('`question` = ' + escape(question))
        } else {
          conditionals.push(`(\
            !(\`flag\` & ${DialogueFlag.regexp}) && \`question\` = ${escape(question)} ||\
            \`flag\` & ${DialogueFlag.regexp} && (\
              ${escape(question)} REGEXP \`question\` || ${escape(original)} REGEXP \`question\`\
            )\
          )`)
        }
      }
    }
  })

  ctx.on('dialogue/before-modify', async ({ options, meta, target }) => {
    if (!target && !(options.question && options.answer)) {
      await meta.$send('缺少问题或回答，请检查指令语法。')
      return true
    }
  })

  ctx.before('dialogue/modify', ({ options }, data) => {
    if (options.answer) {
      data.answer = options.answer
    }

    if (options.question) {
      data.question = options.question
      data.original = options.original
    }

    if (options.regexp !== undefined) {
      data.flag &= ~DialogueFlag.regexp
      data.flag |= +options.regexp * DialogueFlag.regexp
    }
  })

  ctx.on('dialogue/permit', ({ meta, options }) => {
    return options.regexp !== undefined && meta.$user.authority < 3
  })

  ctx.on('dialogue/validate', ({ options }) => {
    if (options.redirectDialogue) {
      options.answer = `\${dialogue ${options.answer}}`
    }
  })
}
