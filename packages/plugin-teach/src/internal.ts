import { Context, UserField } from 'koishi-core'
import { DialogueFlag, Dialogue } from './database'
import { TeachConfig, getDialogues } from './utils'
import { formatAnswers } from './search'

declare module './utils' {
  interface TeachArgv {
    questionMap?: Record<string, Dialogue[]>
  }
}

export function simplifyAnswer (source: string) {
  return (String(source || '')).trim()
}

export default function apply (ctx: Context, config: TeachConfig) {
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

    const [question, original, appellative] = config._stripQuestion(options.question)
    argv.appellative = appellative
    Object.defineProperty(options, '_original', { value: original })
    if (question) {
      options.original = options.question
      options.question = question
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
          conditionals.push(`(
            !(\`flag\` & ${DialogueFlag.regexp}) && \`question\` = ${escape(question)} ||
            \`flag\` & ${DialogueFlag.regexp} && (
              ${escape(question)} REGEXP \`question\` || ${escape(original)} REGEXP \`question\`
            )
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

  ctx.on('dialogue/detail-short', ({ flag }, output) => {
    if (flag & DialogueFlag.regexp) {
      output.questionType = '正则'
    }
  })

  ctx.on('dialogue/detail', ({ original, answer, flag }, output) => {
    if (flag & DialogueFlag.regexp) {
      output.push(`正则：${original}`)
    } else {
      output.push(`问题：${original}`)
    }
    output.push(`回答：${answer}`)
  })

  ctx.on('dialogue/list', ({ _redirections }, output, prefix, argv) => {
    if (!_redirections) return
    output.push(...formatAnswers(argv, _redirections, prefix + '= '))
  })

  ctx.on('dialogue/search', async (argv, test, dialogues) => {
    if (!argv.questionMap) {
      argv.questionMap = { [test.question]: dialogues }
    }
    for (const dialogue of dialogues) {
      const { answer } = dialogue
      if (!answer.startsWith('${dialogue ')) continue
      const [question, original] = argv.config._stripQuestion(answer.slice(11, -1).trimStart())
      if (question in argv.questionMap) continue
      argv.questionMap[question] = await getDialogues(ctx, {
        ...test,
        regexp: null,
        question,
        original,
      })
      Object.defineProperty(dialogue, '_redirections', { writable: true, value: argv.questionMap[question] })
      await argv.ctx.parallelize('dialogue/search', argv, test, argv.questionMap[question])
    }
  })

  ctx.on('dialogue/receive', ({ meta, test }) => {
    if (meta.message.includes('[CQ:image,')) return true
    const [question, original, appellative, activated] = config._stripQuestion(meta.message)
    test.question = question
    test.original = original
    test.activated = activated
    test.appellative = appellative
  })

  ctx.on('dialogue/before-search', (argv, test) => {
    test.appellative = argv.appellative
  })

  ctx.on('dialogue/validate', ({ options }) => {
    if (options.redirectDialogue) {
      options.answer = `\${dialogue ${options.answer}}`
    }
  })

  ctx.on('dialogue/before-send', ({ meta }) => {
    Object.defineProperty(meta, '$_redirected', {
      writable: true,
      value: (meta.$_redirected || 0) + 1,
    })
  })
}
