import { Context, Message } from 'koishi-core'
import { Dialogue } from './utils'
import { create, update } from './update'
import { RegExpValidator } from 'regexpp'
import { defineProperty } from 'koishi-utils'
import { formatQuestionAnswers } from './search'
import { format } from 'util'
import { distance } from 'fastest-levenshtein'

declare module 'koishi-core/dist/command' {
  namespace Command {
    interface Config {
      noInterp?: boolean
    }
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
Message.Teach.MayModifyAnswer = '推测你想修改的是回答而不是问题。发送空行或句号以修改回答，使用 -I 选项以忽略本提示。'
Message.Teach.MaybeRegExp = '推测你想%s的问题是正则表达式。发送空行或句号以添加 -x 选项，使用 -I 选项以忽略本提示。'

export default function apply(ctx: Context, config: Dialogue.Config) {
  defineProperty(ctx.app, 'teachHistory', {})

  ctx.command('teach')
    .option('ignoreHint', '-I  忽略智能提示')
    .option('regexp', '-x  使用正则表达式匹配', { authority: config.authority.regExp })
    .option('regexp', '-X  取消使用正则表达式匹配', { value: false })
    .option('redirect', '=> <answer:string>  重定向到其他问答')
    .action(({ options, args }) => {
      function parseArgument() {
        if (!args.length) return ''
        const [arg] = args.splice(0, 1)
        if (!arg || arg === '~' || arg === '～') return ''
        return arg.trim()
      }

      const question = parseArgument()
      const answer = options.redirect ? `$(dialogue ${options.redirect})` : parseArgument()
      if (args.length) {
        return Message.Teach.TooManyArguments
      } else if (/\[CQ:(?!face)/.test(question)) {
        return Message.Teach.ProhibitedCQCode
      }
      const { unprefixed, prefixed, appellative } = options.regexp
        ? { unprefixed: question, prefixed: question, appellative: false }
        : config._stripQuestion(question)
      defineProperty(options, 'appellative', appellative)
      defineProperty(options, '_original', prefixed)
      defineProperty(options, 'original', question)
      args[0] = unprefixed
      args[1] = answer
      if (!args[0] && !args[1]) args.splice(0, Infinity)
    }, true)

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
    const { options, session, target, dialogues, args } = argv
    const { ignoreHint, regexp } = options
    const [question, answer] = args

    function applySuggestion(argv: Dialogue.Argv) {
      return argv.target ? update(argv) : create(argv)
    }

    // 修改问答时发现可能想改回答但是改了问题
    if (target && !ignoreHint && question && !answer && maybeAnswer(question, dialogues)) {
      const dispose = session.$use(({ content }, next) => {
        dispose()
        content = content.trim()
        if (content && content !== '.' && content !== '。') return next()
        args[1] = options.original
        args[0] = ''
        return applySuggestion(argv)
      })
      return Message.Teach.MayModifyAnswer
    }

    // 如果问题疑似正则表达式但原问答不是正则匹配，提示添加 -x 选项
    if (question && !regexp && maybeRegExp(question) && !ignoreHint && (!target || !dialogues.every(d => d.flag & Dialogue.Flag.regexp))) {
      const dispose = session.$use(({ content }, next) => {
        dispose()
        content = content.trim()
        if (content && content !== '.' && content !== '。') return next()
        options.regexp = true
        return applySuggestion(argv)
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

  ctx.on('dialogue/before-modify', async ({ options, target, args }) => {
    // 添加问答时缺少问题或回答
    if (options.create && !target && !(args[0] && args[1])) {
      return Message.Teach.MissingQuestionOrAnswer
    }
  })

  ctx.on('dialogue/modify', ({ options, args }, data) => {
    if (args[1]) {
      data.answer = args[1]
    }

    if (options.regexp !== undefined) {
      data.flag &= ~Dialogue.Flag.regexp
      data.flag |= +options.regexp * Dialogue.Flag.regexp
    }

    if (args[0]) {
      data.question = args[0]
      data.original = options.original
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

  ctx.before('command', ({ command, session }) => {
    if (command.config.noInterp && session._redirected) {
      return format(Message.Teach.ProhibitedCommand, command.name)
    }
  })
}
