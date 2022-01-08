import { Context, template, defineProperty, segment, Query } from 'koishi'
import { Dialogue } from '../utils'
import { create, update } from '../update'
import { formatQuestionAnswers } from '../search'
import { distance } from 'fastest-levenshtein'

declare module 'koishi' {
  namespace Command {
    interface Config {
      noInterp?: boolean
    }
  }
}

template.set('teach', {
  'too-many-arguments': '存在多余的参数，请检查指令语法或将含有空格或换行的问答置于一对引号内。',
  'missing-question-or-answer': '缺少问题或回答，请检查指令语法。',
  'prohibited-command': '禁止在教学回答中插值调用 {0} 指令。',
  'prohibited-cq-code': '问题必须是纯文本。',
  'illegal-regexp': '问题含有错误的或不支持的正则表达式语法。',
  'probably-modify-answer': '推测你想修改的是回答而不是问题。发送空行或句号以修改回答，使用 -I 选项以忽略本提示。',
  'probably-regexp': '推测你想{0}的问题是正则表达式。发送空行或句号以添加 -x 选项，使用 -I 选项以忽略本提示。',
})

export default function apply(ctx: Context, config: Dialogue.Config) {

  ctx.command('teach')
    .option('ignoreHint', '-I  忽略智能提示')
    .option('regexp', '-x  使用正则表达式匹配', { authority: config.authority.regExp })
    .option('regexp', '-X  取消使用正则表达式匹配', { value: false })
    .option('redirect', '=> <answer:string>  重定向到其他问答')
    .before(({ options, args }) => {
      function parseArgument() {
        if (!args.length) return ''
        const [arg] = args.splice(0, 1)
        if (!arg || arg === '~' || arg === '～') return ''
        return arg.trim()
      }

      const question = parseArgument()
      const answer = options.redirect ? `$(dialogue ${options.redirect})` : parseArgument()
      if (args.length) {
        return template('teach.too-many-arguments')
      } else if (/\[CQ:(?!face)/.test(question)) {
        return template('teach.prohibited-cq-code')
      }
      const { original, parsed, appellative } = options.regexp
        ? { original: segment.unescape(question), parsed: question, appellative: false }
        : config._stripQuestion(question)
      defineProperty(options, 'appellative', appellative)
      defineProperty(options, 'original', original)
      args[0] = parsed
      args[1] = answer
      if (!args[0] && !args[1]) args.splice(0, Infinity)
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

  ctx.before('dialogue/modify', async (argv) => {
    const { options, session, target, dialogues, args } = argv
    const { ignoreHint, regexp } = options
    const [question, answer] = args

    function applySuggestion(argv: Dialogue.Argv) {
      return argv.target ? update(argv) : create(argv)
    }

    // 修改问答时发现可能想改回答但是改了问题
    if (target && !ignoreHint && question && !answer && maybeAnswer(question, dialogues)) {
      const dispose = session.middleware(({ content }, next) => {
        dispose()
        content = content.trim()
        if (content && content !== '.' && content !== '。') return next()
        args[1] = options.original
        args[0] = ''
        return applySuggestion(argv)
      })
      return template('teach.probably-modify-answer')
    }

    // 如果问题疑似正则表达式但原问答不是正则匹配，提示添加 -x 选项
    if (question && !regexp && maybeRegExp(question) && !ignoreHint && (!target || !dialogues.every(d => d.flag & Dialogue.Flag.regexp))) {
      const dispose = session.middleware(({ content }, next) => {
        dispose()
        content = content.trim()
        if (content && content !== '.' && content !== '。') return next()
        options.regexp = true
        return applySuggestion(argv)
      })
      return template('teach.probably-regexp', target ? '修改' : '添加')
    }

    // 检测正则表达式的合法性
    if (regexp || regexp !== false && question && dialogues.some(d => d.flag & Dialogue.Flag.regexp)) {
      const questions = question ? [question] : dialogues.map(d => d.question)
      try {
        questions.forEach(q => new RegExp(q))
      } catch (error) {
        return template('teach.illegal-regexp')
      }
    }
  })

  ctx.before('dialogue/modify', async ({ options, target, args }) => {
    // 添加问答时缺少问题或回答
    if (options.create && !target && !(args[0] && args[1])) {
      return template('teach.missing-question-or-answer')
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
    ctx.before('dialogue/search', ({ options }, test) => {
      test[flag] = options[flag]
    })

    ctx.on('dialogue/modify', ({ options }: Dialogue.Argv, data: Dialogue) => {
      if (options[flag] !== undefined) {
        data.flag &= ~Dialogue.Flag[flag]
        data.flag |= +options[flag] * Dialogue.Flag[flag]
      }
    })

    ctx.on('dialogue/test', (test, query) => {
      if (test[flag] === undefined) return
      query.$and.push({
        flag: { [test[flag] ? '$bitsAllSet' : '$bitsAllClear']: Dialogue.Flag[flag] },
      })
    })
  })

  ctx.on('command/check', ({ command, session }) => {
    if (command.config.noInterp && session._redirected) {
      return template('teach.prohibited-command', command.name)
    }
  })

  ctx.before('dialogue/modify', async ({ args }) => {
    if (!args[1] || !ctx.assets) return
    try {
      args[1] = await ctx.assets.transform(args[1])
    } catch (error) {
      ctx.logger('teach').warn(error.message)
      return '上传图片时发生错误。'
    }
  })

  ctx.on('dialogue/test', ({ regexp, answer, question, original }, query) => {
    if (regexp) {
      if (answer) query.answer = { $regex: new RegExp(answer, 'i') }
      if (original) query.original = { $regex: new RegExp(original, 'i') }
      return
    }
    if (answer) query.answer = answer
    if (regexp === false) {
      if (question) query.question = question
    } else if (original) {
      const $or: Query.Expr<Dialogue>[] = [{
        flag: { $bitsAllSet: Dialogue.Flag.regexp },
        original: { $regexFor: original },
      }]
      if (question) $or.push({ flag: { $bitsAllClear: Dialogue.Flag.regexp }, question })
      query.$and.push({ $or })
    }
  })
}
