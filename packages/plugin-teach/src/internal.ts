import { Context } from 'koishi-core'
import { DialogueFlag, Dialogue } from './database'
import { update } from './update'
import { RegExpValidator } from 'regexpp'
import { Logger } from 'koishi-utils'
import { types } from 'util'
import leven from 'leven'
import { escape } from 'mysql'
import { formatQuestionAnswers } from './search'

class RegExpError extends Error {
  name = 'RegExpError'
}

const validator = new RegExpValidator({
  onEscapeCharacterSet(start, end, kind, negate) {
    // eslint-disable-next-line curly
    if (kind === 'space') throw negate
      ? new RegExpError('四季酱会自动删除问题中的空白字符，你无需使用 \\s。')
      : new RegExpError('四季酱会自动删除问题中的空白字符，请使用 . 代替 \\S。')
    let chars = kind === 'digit' ? '0-9' : '_0-9a-z'
    let source = kind === 'digit' ? 'd' : 'w'
    if (negate) {
      chars = '^' + chars
      source = source.toUpperCase()
    }
    throw new RegExpError(`目前不支持在正则表达式中使用 \\${source}，请使用 [${chars}] 代替。`)
  },
  onQuantifier(start, end, min, max, greedy) {
    if (!greedy) throw new RegExpError('目前不支持在正则表达式中使用非贪婪匹配语法。')
  },
  onWordBoundaryAssertion() {
    throw new RegExpError('目前不支持在正则表达式中使用单词边界。')
  },
  onLookaroundAssertionEnter() {
    throw new RegExpError('目前不支持在正则表达式中使用断言。')
  },
  onGroupEnter() {
    throw new RegExpError('目前不支持在正则表达式中使用非捕获组。')
  },
  onCapturingGroupEnter(start, name) {
    if (name) throw new RegExpError('目前不支持在正则表达式中使用具名组。')
  },
})

export default function apply(ctx: Context, config: Dialogue.Config) {
  const logger = Logger.create('teach')

  ctx.command('teach')
    .option('question', '<question>  问题', { type: 'string' })
    .option('answer', '<answer>  回答', { type: 'string' })
    .option('ignoreHint', '-i  忽略智能提示')
    .option('regexp', '-x  使用正则表达式匹配', { authority: 3 })
    .option('regexp', '-X  取消使用正则表达式匹配', { authority: 3, value: false })
    .option('redirect', '=> <answer>  重定向到其他问答')

  ctx.before('dialogue/validate', (argv) => {
    const { options, args } = argv
    if (args.length) {
      return '存在多余的参数，请检查指令语法或将含有空格或换行的问答置于一对引号内。'
    }

    if (options.noRegexp) options.regexp = false

    const { answer } = options
    const question = options.question || ''
    if (/\[CQ:(?!face)/.test(question)) {
      return '问题必须是纯文本。'
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
    if (regexp) {
      if (answer !== undefined) conditionals.push('`answer` REGEXP ' + escape(answer))
      if (question !== undefined) conditionals.push('`question` REGEXP ' + escape(original))
      return
    }

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
  })

  function maybeAnswer(question: string, dialogues: Dialogue[]) {
    return dialogues.every(dialogue => {
      const dist = leven(question, dialogue.answer)
      return dist < dialogue.answer.length / 2
        && dist < leven(question, dialogue.question)
    })
  }

  function maybeRegExp(question: string) {
    return question.startsWith('^') || question.endsWith('$')
  }

  ctx.on('dialogue/before-modify', async (argv) => {
    const { options, session, target, dialogues } = argv
    const { question, answer, ignoreHint, regexp } = options

    // 修改问答时发现可能想改回答但是改了问题
    if (target && !ignoreHint && question && !answer && maybeAnswer(question, dialogues)) {
      const dispose = session.$use(({ message }, next) => {
        dispose()
        message = message.trim()
        if (message && message !== '.' && message !== '。') return next()
        options.answer = options.original
        delete options.question
        return update(argv)
      })
      await session.$send('推测你想修改的是回答而不是问题。发送空行或句号以修改回答，使用 -i 选项以忽略本提示。')
      return true
    }

    // 如果问题疑似正则表达式但原问答不是正则匹配，提示添加 -x 选项
    if (question && !regexp && maybeRegExp(question) && !ignoreHint && (!target || !dialogues.every(d => d.flag & DialogueFlag.regexp))) {
      const dispose = session.$use(({ message }, next) => {
        dispose()
        message = message.trim()
        if (message && message !== '.' && message !== '。') return next()
        options.regexp = true
        return update(argv)
      })
      await session.$send(`推测你想${target ? '修改' : '添加'}的问题是正则表达式。发送空行或句号以添加 -x 选项，使用 -i 选项以忽略本提示。`)
      return true
    }

    // 检测正则表达式的合法性
    if (regexp || regexp !== false && question && dialogues.some(d => d.flag & DialogueFlag.regexp)) {
      const questions = question ? [question as string] : dialogues.map(d => d.question)
      try {
        questions.map(q => validator.validatePattern(q))
      } catch (error) {
        if (!types.isNativeError(error)) {
          logger.warn(question, error)
          await session.$send('问题含有错误的或不支持的正则表达式语法。')
        } else if (error.name === 'RegExpError') {
          await session.$send(error.message)
        } else {
          if (!error.message.startsWith('SyntaxError')) {
            logger.warn(question, error.stack)
          }
          await session.$send('问题含有错误的或不支持的正则表达式语法。')
        }
        return true
      }
    }
  })

  ctx.on('dialogue/before-create', async ({ options, session, target }) => {
    // 添加问答时缺少问题或回答
    if (!target && !(options.question && options.answer)) {
      await session.$send('缺少问题或回答，请检查指令语法。')
      return true
    }
  })

  ctx.before('dialogue/modify', ({ options }, data) => {
    if (options.answer) {
      data.answer = options.answer
    }

    if (options.regexp !== undefined) {
      data.flag &= ~DialogueFlag.regexp
      data.flag |= +options.regexp * DialogueFlag.regexp
    }

    if (options.question) {
      data.question = options.question
      data.original = options.original
    }
  })

  ctx.on('dialogue/validate', ({ options }) => {
    if (options.redirect) {
      options.answer = `%{dialogue ${options.answer}}`
    }
  })

  ctx.on('dialogue/detail', async (dialogue, output, argv) => {
    if (dialogue._redirections?.length) {
      output.push('重定向到：', ...formatQuestionAnswers(argv, dialogue._redirections))
    }
  })
}
