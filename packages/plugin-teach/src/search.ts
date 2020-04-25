import { TeachArgv, getDialogues, isPositiveInteger, parseTeachArgs } from './utils'
import { Dialogue, DialogueTest, DialogueFlag } from './database'
import { Context } from 'koishi-core'

declare module './database' {
  interface Dialogue {
    _redirections: Dialogue[]
  }
}

declare module './utils' {
  interface TeachConfig {
    itemsPerPage?: number
    mergeThreshold?: number
    maxAnswerLength?: number
  }
}

export default function apply (ctx: Context) {
  ctx.command('teach')
    .option('--search', '搜索已有问答', { notUsage: true })
    .option('--page <page>', '设置搜索结果的页码', { validate: isPositiveInteger })
    .option('--auto-merge', '自动合并相同的问题和回答')
    .option('|, --pipe <op...>', '对每个搜索结果执行操作')

  ctx.before('dialogue/execute', (argv) => {
    if (argv.options.search) return search(argv)
  })
}

async function search (argv: TeachArgv) {
  const { ctx, meta, options } = argv
  const { keyword, question, answer, page = 1, original, pipe, redirect } = options
  const { itemsPerPage = 20, mergeThreshold = 5, maxAnswerLength = 100, _stripQuestion } = argv.config

  const test: DialogueTest = { question, answer, keyword }
  if (await ctx.serialize('dialogue/before-search', argv, test)) return
  const dialogues = await getDialogues(ctx, test)

  if (pipe) {
    if (!dialogues.length) return meta.$send('没有搜索到任何问答。')
    const command = ctx.getCommand('teach', meta)
    parseTeachArgs(Object.assign(meta.$argv, command.parse(pipe)))
    meta.$argv.options.target = dialogues.map(d => d.id).join(',')
    return command.execute(meta.$argv)
  }

  if (redirect) {
    const idSet = new Set()
    await getRedirections(dialogues)

    async function getRedirections (dialogues: Dialogue[]) {
      for (const dialogue of dialogues) {
        const { id, flag, answer } = dialogue
        if (idSet.has(id) || !(flag & DialogueFlag.redirect) || !answer.startsWith('dialogue ')) continue
        idSet.add(id)
        const [question] = _stripQuestion(answer.slice(9).trimStart())
        const redirections = await getDialogues(ctx, {
          ...test,
          keyword: false,
          question,
        })
        Object.defineProperty(dialogue, '_redirections', { writable: true, value: redirections })
        await getRedirections(redirections)
      }
    }
  }

  function formatAnswer (source: string) {
    let trimmed = false
    const lines = source.split(/(\r?\n|\$n)/g)
    if (lines.length > 1) {
      trimmed = true
      source = lines[0].trim()
    }
    source = source.replace(/\[CQ:image,[^\]]+\]/g, '[图片]')
    if (source.length > maxAnswerLength) {
      trimmed = true
      source = source.slice(0, maxAnswerLength)
    }
    if (trimmed && !source.endsWith('……')) {
      if (source.endsWith('…')) {
        source += '…'
      } else {
        source += '……'
      }
    }
    return source
  }

  function formatPrefix (dialogue: Dialogue) {
    const output: string[] = []
    ctx.emit('dialogue/detail-short', dialogue, output, argv)
    return `${dialogue.id}. ${output.length ? `[${output.join(', ')}] ` : ''}`
  }

  function formatAnswers (dialogues: Dialogue[], padding = 0) {
    return dialogues.map((dialogue) => {
      const { flag, answer, _redirections } = dialogue
      const type = flag & DialogueFlag.redirect ? '[重定向] ' : ''
      const output = `${'=> '.repeat(padding)}${formatPrefix(dialogue)}${type}${formatAnswer(answer)}`
      if (!_redirections) return output
      return [output, ...formatAnswers(_redirections, padding + 1)].join('\n')
    })
  }

  function formatQuestionAnswers (dialogues: Dialogue[]) {
    return dialogues.map((dialogue) => {
      const { flag, original, answer, _redirections } = dialogue
      const type = flag & DialogueFlag.redirect ? '重定向' : '回答'
      const output = `${formatPrefix(dialogue)}问题：${original}，${type}：${formatAnswer(answer)}`
      if (!_redirections) return output
      return [output, ...formatAnswers(_redirections, 1)].join('\n')
    })
  }

  function sendResult (title: string, output: string[], suffix?: string) {
    if (output.length <= itemsPerPage) {
      output.unshift(title + '：')
      if (suffix) output.push(suffix)
    } else {
      const pageCount = Math.ceil(output.length / itemsPerPage)
      output = output.slice((page - 1) * itemsPerPage, page * itemsPerPage)
      output.unshift(title + `（第 ${page}/${pageCount} 页）：`)
      if (suffix) output.push(suffix)
      output.push('可以使用 --page 或在 ## 之后加上页码以调整输出的条目页数。')
    }
    return meta.$send(output.join('\n'))
  }

  if (!question && !answer) {
    if (!dialogues.length) return meta.$send('没有搜索到任何回答，尝试切换到其他环境。')
    return sendResult('全部问答如下', formatQuestionAnswers(dialogues))
  }

  if (!options.keyword) {
    if (!question) {
      if (!dialogues.length) return meta.$send(`没有搜索到回答“${answer}”，请尝试使用关键词匹配。`)
      const output = dialogues.map(d => `${formatPrefix(d)}${d.original}`)
      return sendResult(`回答“${answer}”的问题如下`, output)
    } else if (!answer) {
      if (!dialogues.length) return meta.$send(`没有搜索到问题“${original}”，请尝试使用关键词匹配。`)
      const output = formatAnswers(dialogues)
      const totalS = dialogues.reduce((prev, curr) => prev + curr.probS, 0)
      const totalA = dialogues.reduce((prev, curr) => prev + curr.probA, 0)
      return sendResult(`问题“${original}”的回答如下`, output, dialogues.length > 1
        ? `总触发概率：p=${+totalS.toFixed(3)}, P=${+totalA.toFixed(3)}。`
        : '')
    } else {
      if (!dialogues.length) return meta.$send(`没有搜索到问答“${original}”“${answer}”，请尝试使用关键词匹配。`)
      const output = [dialogues.map(d => d.id).join(', ')]
      return sendResult(`“${original}”“${answer}”匹配的回答如下`, output)
    }
  }

  let output: string[]
  if (!options.autoMerge || question && answer) {
    output = formatQuestionAnswers(dialogues)
  } else {
    const idMap: Record<string, number[]> = {}
    for (const dialogue of dialogues) {
      const key = question ? dialogue.original : dialogue.answer
      if (!idMap[key]) idMap[key] = []
      idMap[key].push(dialogue.id)
    }
    output = Object.keys(idMap).map((key) => {
      const { length } = idMap[key]
      return length <= mergeThreshold
        ? `${key} (#${idMap[key].join(', #')})`
        : `${key} (共 ${length} 个${question ? '回答' : '问题'})`
    })
  }

  if (!question) {
    if (!dialogues.length) return meta.$send(`没有搜索到含有关键词“${answer}”的回答。`)
    return sendResult(`回答关键词“${answer}”的搜索结果如下`, output)
  } else if (!answer) {
    if (!dialogues.length) return meta.$send(`没有搜索到含有关键词“${original}”的问题。`)
    return sendResult(`问题关键词“${original}”的搜索结果如下`, output)
  } else {
    if (!dialogues.length) return meta.$send(`没有搜索到含有关键词“${original}”“${answer}”的问答。`)
    return sendResult(`问答关键词“${original}”“${answer}”的搜索结果如下`, output)
  }
}
