import { Context } from 'koishi-core'
import { DialogueFlag } from './database'
import { TeachConfig, isZeroToOne } from './utils'

export function simplifyAnswer (source: string) {
  return (String(source || '')).trim()
}

export default function apply (ctx: Context, config: TeachConfig) {
  ctx.command('teach')
    .option('--question <question>', '问题', { isString: true })
    .option('--answer <answer>', '回答', { isString: true })
    .option('-p, --probability-strict <prob>', '设置问题的触发权重', { validate: isZeroToOne })
    .option('-P, --probability-appellative <prob>', '设置被称呼时问题的触发权重', { validate: isZeroToOne })
    .option('-k, --keyword', '使用关键词匹配')
    // .option('-K, --no-keyword', '取消使用关键词匹配')
    .option('-c, --redirect', '使用指令重定向')
    .option('-C, --no-redirect', '取消使用指令重定向')
    .option('=>, --redirect-dialogue', '重定向到其他问答')

  ctx.before('dialogue/validate', ({ options, meta, args }) => {
    if (args.length) {
      return meta.$send('存在多余的参数，请检查指令语法或将含有空格或换行的问答置于一对引号内。')
    }

    const { answer, redirectDialogue } = options
    if (String(options.question).includes('[CQ:image,')) {
      return meta.$send('问题不能包含图片。')
    }

    options.question = config._stripQuestion(options.question)[0]
    if (options.question) {
      options.original = options.question
    } else {
      delete options.question
    }

    options.answer = (String(answer || '')).trim()
    if (!options.answer) {
      delete options.answer
    } else if (redirectDialogue) {
      options.redirect = true
      options.answer = 'dialogue ' + options.answer
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

    if (options.probabilityStrict !== undefined) {
      data.probS = options.probabilityStrict
    }

    if (options.probabilityAppellative !== undefined) {
      data.probA = options.probabilityAppellative
    }

    if (options.keyword !== undefined) {
      data.flag &= ~DialogueFlag.keyword
      data.flag |= +options.keyword * DialogueFlag.keyword
    }

    if (options.redirect !== undefined) {
      data.flag &= ~DialogueFlag.redirect
      data.flag |= +options.redirect * DialogueFlag.redirect
    }
  })

  ctx.on('dialogue/detail', ({ original, flag, answer, probS, probA }, output) => {
    output.push(`问题：${original}`)

    if (!(flag & DialogueFlag.redirect)) {
      output.push(`回答：${answer}`)
    } else if (answer.startsWith('dialogue ')) {
      output.push(`重定向到问题：${answer.slice(9).trimStart()}`)
    } else {
      output.push(`重定向到指令：${answer}`)
    }

    if (!probS) {
      if (probA === 1) {
        output.push('必须带称呼触发。')
      } else if (probA) {
        output.push(`必须带称呼触发，权重：${probA}`)
      } else {
        output.push('权重为零，无法触发。')
      }
    } else if (probS === 1) {
      if (probA === 1) {
        output.push('允许带称呼触发。')
      } else if (probA) {
        output.push(`允许带称呼触发，权重：${probA}`)
      }
    } else {
      if (probA) {
        output.push(`触发权重：p=${probS}/P=${probA}`)
      } else {
        output.push(`触发权重：${probS}`)
      }
    }
  })

  ctx.on('dialogue/detail-short', ({ probS, probA }, output) => {
    if (probS < 1 || probA > 0) output.push(`p=${probS}`, `P=${probA}`)
  })

  ctx.on('dialogue/receive', (meta, test) => {
    if (meta.message.includes('[CQ:image,')) return true
    const [question, appellative] = config._stripQuestion(meta.message)
    test.question = question
    test.appellative = appellative
    return !question
  })
}
