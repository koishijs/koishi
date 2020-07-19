import { Context } from 'koishi-core'
import { DialogueFlag, Dialogue } from './database'
import { update } from './update'
import leven from 'leven'

export function simplifyAnswer (source: string) {
  return (String(source || '')).trim()
}

export default function apply (ctx: Context, config: Dialogue.Config) {
  ctx.command('teach')
    .option('--question <question>', '问题', { isString: true })
    .option('--answer <answer>', '回答', { isString: true })
    .option('-i, --ignore-hint', '忽略智能提示')
    .option('-x, --regexp', '使用正则表达式匹配', { authority: 3 })
    .option('-X, --no-regexp', '取消使用正则表达式匹配', { authority: 3 })
    .option('=>, --redirect-dialogue <answer>', '重定向到其他问答')

  ctx.before('dialogue/validate', (argv) => {
    const { options, meta, args } = argv
    if (args.length) {
      return meta.$send('存在多余的参数，请检查指令语法或将含有空格或换行的问答置于一对引号内。')
    }

    if (options.noRegexp) options.regexp = false

    const { answer } = options
    if (String(options.question).includes('[CQ:')) {
      return meta.$send('问题必须是纯文本。')
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

  function isCloserToAnswer (dialogues: Dialogue[], question: string) {
    return dialogues.every(dialogue => {
      const dist = leven(question, dialogue.answer)
      return dist < dialogue.answer.length / 2
        && dist < leven(question, dialogue.question)
    })
  }

  ctx.on('dialogue/before-modify', async (argv) => {
    const { options, meta, target, dialogues } = argv
    const { question, answer, ignoreHint } = options

    // 修改问答时发现可能想改回答但是改了问题
    if (target && !ignoreHint && question && !answer && isCloserToAnswer(dialogues, question)) {
      meta.$app.onceMiddleware(async (meta, next) => {
        const message = meta.message.trim()
        if (message && message !== '.' && message !== '。') return next()
        options.answer = options.original
        delete options.question
        return update(argv)
      }, meta)
      await meta.$send('四推测你想修改的是回答而不是问题。发送空行或句号以修改回答，添加 -i 选项以忽略本提示。')
      return true
    }
  })

  ctx.on('dialogue/before-create', async ({ options, meta, target }) => {
    // 添加问答时缺少问题或回答
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

  ctx.on('dialogue/validate', ({ options }) => {
    if (options.redirectDialogue) {
      options.answer = `\${dialogue ${options.answer}}`
    }
  })
}
