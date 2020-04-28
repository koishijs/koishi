import { Context } from 'koishi-core'
import { DialogueFlag } from './database'
import { TeachConfig } from './utils'

export function simplifyAnswer (source: string) {
  return (String(source || '')).trim()
}

export default function apply (ctx: Context, config: TeachConfig) {
  ctx.command('teach')
    .option('--question <question>', '问题', { isString: true })
    .option('--answer <answer>', '回答', { isString: true })
    .option('-k, --keyword', '使用关键词匹配')
    // .option('-K, --no-keyword', '取消使用关键词匹配')

  ctx.before('dialogue/validate', (argv) => {
    const { options, meta, args } = argv
    if (args.length) {
      return meta.$send('存在多余的参数，请检查指令语法或将含有空格或换行的问答置于一对引号内。')
    }

    const { answer } = options
    if (String(options.question).includes('[CQ:image,')) {
      return meta.$send('问题不能包含图片。')
    }

    const [question, appellative] = config._stripQuestion(options.question)
    argv.appellative = appellative
    if (question) {
      options.original = options.question
      options.question = question
    } else {
      delete options.question
    }

    options.answer = (String(answer || '')).trim()
    if (!options.answer) delete options.answer
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

    if (options.keyword !== undefined) {
      data.flag &= ~DialogueFlag.keyword
      data.flag |= +options.keyword * DialogueFlag.keyword
    }
  })

  ctx.on('dialogue/detail', ({ original, answer }, output) => {
    output.push(`问题：${original}`, `回答：${answer}`)
  })

  ctx.on('dialogue/receive', ({ meta, test }) => {
    if (meta.message.includes('[CQ:image,')) return true
    const [question, appellative, activated] = config._stripQuestion(meta.message)
    test.question = question
    test.activated = activated
    test.appellative = appellative
    return !question
  })
}
