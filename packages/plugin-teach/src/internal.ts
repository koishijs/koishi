import { Context } from 'koishi-core'
import { DialogueFlag } from './database'
import { simplifyQuestion, simplifyAnswer } from './utils'

export default function apply (ctx: Context) {
  ctx.command('teach')
    .option('--question <question>', '问题', { isString: true, hidden: true })
    .option('--answer <answer>', '回答', { isString: true, hidden: true })
    .option('-p, --probability <prob>', '设置问题的触发权重', { hidden: true })
    .option('-k, --keyword', '使用关键词匹配', { hidden: true })
    // .option('-K, --no-keyword', '取消使用关键词匹配')

  ctx.before('dialogue/validate', ({ options, meta, args }) => {
    if (args.length) {
      return meta.$send('存在多余的参数，请检查指令语法或将含有空格或换行的问答置于一对引号内。')
    }

    const { question, answer, probability } = options
    if (String(question).includes('[CQ:image,')) {
      return meta.$send('问题不能包含图片。')
    }

    options.question = simplifyQuestion(question)
    if (options.question) {
      options.original = question
    } else {
      delete options.question
    }

    options.answer = simplifyAnswer(answer)
    if (!options.answer) {
      delete options.answer
    }

    if (probability !== undefined && !(probability > 0 && probability <= 1)) {
      return meta.$send('参数 -p, --probability 应为不超过 1 的正数。')
    }
  })

  ctx.on('dialogue/before-modify', async ({ options, meta, target }) => {
    if (options.probability === undefined) {
      options.probability = 1
    }

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

    if (options.probability !== undefined) {
      data.probability = options.probability
    }

    if (options.keyword !== undefined) {
      data.flag &= ~DialogueFlag.keyword
      data.flag |= +options.keyword * DialogueFlag.keyword
    }  
  })

  ctx.on('dialogue/detail-short', (dialogue, output) => {
    if (dialogue.probability < 1) output.push(`p=${dialogue.probability}`)
  })

  ctx.on('dialogue/receive', (meta, test) => {
    if (meta.message.includes('[CQ:image,')) return true
    test.question = simplifyQuestion(meta.message)
  })
}
