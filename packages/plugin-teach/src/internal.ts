import { Context } from 'koishi-core'
import { simplify } from 'koishi-utils'
import { DialogueFlag } from './database'
import { TeachConfig, isZeroToOne } from './utils'

const prefixPunctuation = /^([()\]]|\[(?!cq:))*/
const suffixPunctuation = /([.,?!()[~]|(?<!\[cq:[^\]]+)\])*$/

export function stripPunctuation (source: string) {
  source = source.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/，/g, ',')
    .replace(/、/g, ',')
    .replace(/。/g, '.')
    .replace(/？/g, '?')
    .replace(/！/g, '!')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/【/g, '[')
    .replace(/】/g, ']')
    .replace(/～/g, '~')
  return source
    .replace(prefixPunctuation, '')
    .replace(suffixPunctuation, '') || source
}

export function simplifyQuestion (source: string) {
  return simplify(stripPunctuation(String(source || '')))
}

export function simplifyAnswer (source: string) {
  return (String(source || '')).trim()
}

export default function apply (ctx: Context, config: TeachConfig) {
  ctx.command('teach')
    .option('--question <question>', '问题', { isString: true })
    .option('--answer <answer>', '回答', { isString: true })
    .option('-p, --probability <prob>', '设置问题的触发权重', { validate: isZeroToOne })
    .option('-P, --probability-appellation <prob>', '设置被称呼时问题的触发权重', { validate: isZeroToOne })
    .option('-k, --keyword', '使用关键词匹配')
    // .option('-K, --no-keyword', '取消使用关键词匹配')
    .option('-c, --redirect', '使用指令重定向')
    .option('-C, --no-redirect', '取消使用指令重定向')
    .option('=>, --redirect-dialogue', '重定向到其他问答')

  ctx.before('dialogue/validate', ({ options, meta, args }) => {
    if (args.length) {
      return meta.$send('存在多余的参数，请检查指令语法或将含有空格或换行的问答置于一对引号内。')
    }

    const { question, answer, redirectDialogue } = options
    if (String(question).includes('[CQ:image,')) {
      return meta.$send('问题不能包含图片。')
    }

    options.question = simplifyQuestion(question)
    const capture = config.nicknameRE.exec(options.question)
    if (capture && capture[0].length < options.question.length) {
      options.question = options.question.slice(capture[0].length)
    }
    if (options.question) {
      options.original = question
    } else {
      delete options.question
    }

    options.answer = simplifyAnswer(answer)
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

    if (options.probability !== undefined) {
      data.probability = options.probability
    }

    if (options.probabilityAppellation !== undefined) {
      data.probabilityA = options.probabilityAppellation
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

  ctx.on('dialogue/detail', ({ original, flag, answer, probability: probabilityS, probabilityA }, output) => {
    output.push(`问题：${original}`)

    if (!(flag & DialogueFlag.redirect)) {
      output.push(`回答：${answer}`)
    } else if (answer.startsWith('dialogue ')) {
      output.push(`重定向到问题：${answer.slice(9).trimStart()}`)
    } else {
      output.push(`重定向到指令：${answer}`)
    }

    if (!probabilityS) {
      if (probabilityA === 1) {
        output.push('必须带称呼触发。')
      } else if (probabilityA) {
        output.push(`必须带称呼触发，权重：${probabilityA}`)
      } else {
        output.push('权重为零，无法触发。')
      }
    } else if (probabilityS === 1) {
      if (probabilityA === 1) {
        output.push('允许带称呼触发。')
      } else if (probabilityA) {
        output.push(`允许带称呼触发，权重：${probabilityA}`)
      }
    } else {
      if (probabilityA) {
        output.push(`不带称呼/带称呼触发权重：${probabilityS}/${probabilityA}`)
      } else {
        output.push(`触发权重：${probabilityS}`)
      }
    }
  })

  ctx.on('dialogue/detail-short', ({ probability: probabilityS, probabilityA }, output) => {
    if (probabilityS < 1 || probabilityA > 0) output.push(`p=${probabilityS}`, `P=${probabilityA}`)
  })

  ctx.on('dialogue/receive', (meta, test) => {
    if (meta.message.includes('[CQ:image,')) return true
    test.question = simplifyQuestion(meta.message)
    return !test.question
  })
}
