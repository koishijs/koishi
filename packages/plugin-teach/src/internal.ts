import { Context, Message } from 'koishi-core'
import { Dialogue } from './utils'
import { update } from './update'
import { RegExpValidator } from 'regexpp'
import { defineProperty } from 'koishi-utils'
import { formatQuestionAnswers } from './search'
import { format } from 'util'
import { distance } from 'fastest-levenshtein'

declare module 'koishi-core/dist/command' {
  interface CommandConfig {
    noInterp?: boolean
  }
}

declare module 'koishi-core/dist/plugins/message' {
  namespace Message {
    export namespace Teach {
      let TooManyArguments: string
      let MissingQuestionOrAnswer: string
      let ProhibitedCommand: string
      let ProhibitedCQCode: string
      let IllegalRegExp: string
      let MayModifyAnswer: string
      let MaybeRegExp: string
    }
  }
}

Message.Teach = {} as any
Message.Teach.TooManyArguments = '存在多余的参数，请检查指令语法或将含有空格或换行的问答置于一对引号内。'
Message.Teach.MissingQuestionOrAnswer = '缺少问题或回答，请检查指令语法。'
Message.Teach.ProhibitedCommand = '禁止在教学回答中插值调用 %s 指令。'
Message.Teach.ProhibitedCQCode = '问题必须是纯文本。'
Message.Teach.IllegalRegExp = '问题含有错误的或不支持的正则表达式语法。'
Message.Teach.MayModifyAnswer = '推测你想修改的是回答而不是问题。发送空行或句号以修改回答，使用 -i 选项以忽略本提示。'
Message.Teach.MaybeRegExp = '推测你想%s的问题是正则表达式。发送空行或句号以添加 -x 选项，使用 -i 选项以忽略本提示。'

export default function apply(ctx: Context, config: Dialogue.Config) {
  defineProperty(ctx.app, 'teachHistory', {})

  ctx.command('teach')
    .option('question', '<question>  问题', { type: 'string' })
    .option('answer', '<answer>  回答', { type: 'string' })
    .option('ignoreHint', '-i  忽略智能提示')
    .option('regexp', '-x  使用正则表达式匹配', { authority: 3 })
    .option('regexp', '-X  取消使用正则表达式匹配', { authority: 3, value: false })
    .option('redirect', '=> <answer>  重定向到其他问答')

  ctx.on('dialogue/validate', (argv) => {
    const { options, args } = argv
    if (args.length) {
      return Message.Teach.TooManyArguments
    }

    const { answer } = options
    const question = options.question || ''
    if (/\[CQ:(?!face)/.test(question)) {
      return Message.Teach.ProhibitedCQCode
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

  function maybeAnswer(question: string, dialogues: Dialogue[]) {
    return dialogues.every(dialogue => {
      const dist = distance(question, dialogue.answer)
      return dist < dialogue.answer.length / 2
        && dist < distance(question, dialogue.question)
    })
  }

  function maybeRegExp(question: string) {
    return question.startsWith('^') || question.endsWith('$')
  }

  const validator = new RegExpValidator(config.validateRegExp)

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
      return Message.Teach.MayModifyAnswer
    }

    // 如果问题疑似正则表达式但原问答不是正则匹配，提示添加 -x 选项
    if (question && !regexp && maybeRegExp(question) && !ignoreHint && (!target || !dialogues.every(d => d.flag & Dialogue.Flag.regexp))) {
      const dispose = session.$use(({ message }, next) => {
        dispose()
        message = message.trim()
        if (message && message !== '.' && message !== '。') return next()
        options.regexp = true
        return update(argv)
      })
      return format(Message.Teach.MaybeRegExp, target ? '修改' : '添加')
    }

    // 检测正则表达式的合法性
    if (regexp || regexp !== false && question && dialogues.some(d => d.flag & Dialogue.Flag.regexp)) {
      const questions = question ? [question as string] : dialogues.map(d => d.question)
      try {
        questions.map(q => validator.validatePattern(q))
      } catch (error) {
        return Message.Teach.IllegalRegExp
      }
    }
  })

  ctx.on('dialogue/before-modify', async ({ options, target }) => {
    // 添加问答时缺少问题或回答
    if (options.create && !target && !(options.question && options.answer)) {
      return Message.Teach.MissingQuestionOrAnswer
    }
  })

  ctx.on('dialogue/modify', ({ options }, data) => {
    if (options.answer) {
      data.answer = options.answer
    }

    if (options.regexp !== undefined) {
      data.flag &= ~Dialogue.Flag.regexp
      data.flag |= +options.regexp * Dialogue.Flag.regexp
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

  ctx.on('dialogue/flag', (flag) => {
    ctx.on('dialogue/before-search', ({ options }, test) => {
      test[flag] = options[flag]
    })

    ctx.on('dialogue/modify', ({ options }: Dialogue.Argv, data: Dialogue) => {
      if (options[flag] !== undefined) {
        data.flag &= ~Dialogue.Flag[flag]
        data.flag |= +options[flag] * Dialogue.Flag[flag]
      }
    })
  })

  ctx.on('before-command', ({ command, session }) => {
    if (command.config.noInterp && session._redirected) {
      return format(Message.Teach.ProhibitedCommand, command.name)
    }
  })
}
