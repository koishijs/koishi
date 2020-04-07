import { TeachArgv, sendDetail, getDialogues, isPositiveInteger } from './utils'
import { Dialogue, DialogueTest, DialogueFlag } from './database'
import { Context } from 'koishi-core'

declare module './utils' {
  interface TeachConfig {
    itemsPerPage?: number
    mergeThreshold?: number
  }
}

function formatAnswer (source: string) {
  const lines = source.split(/(\r?\n|\$n)/g)
  const output = lines.length > 1 ? lines[0].trim() + '……' : lines[0]
  return output.replace(/\[CQ:image,[^\]]+\]/g, '[图片]')
}

export default function apply (ctx: Context) {
  ctx.command('teach')
    .option('--search', '搜索已有问答', { notUsage: true, isString: true })
    .option('--page <page>', '设置搜索结果的页码', { validate: isPositiveInteger })
    .option('--auto-merge', '自动合并相同的问题和回答')
    .option('|, --pipe <op...>', '对每个搜索结果执行操作', { authority: 3 })

  ctx.before('dialogue/execute', (argv) => {
    if (argv.options.search) return search(argv)
  })
}

async function search (argv: TeachArgv) {
  const { ctx, meta, options } = argv
  const { keyword, question, answer, page = 1, original, pipe } = options
  const { itemsPerPage = 20, mergeThreshold = 5 } = argv.config

  const test: DialogueTest = { question, answer, keyword }
  if (await ctx.serialize('dialogue/before-search', argv, test)) return
  const dialogues = await getDialogues(ctx, test)

  if (pipe) {
    if (!dialogues.length) return meta.$send('没有搜索到任何问答。')
    const command = ctx.getCommand('teach', meta)
    Object.assign(meta.$argv, command.parse(pipe))
    meta.$argv.options.target = dialogues.map(d => d.id).join(',')
    return command.execute(meta.$argv)
  }

  function formatPrefix (dialogue: Dialogue) {
    const output: string[] = []
    ctx.emit('dialogue/detail-short', dialogue, output, argv)
    return `${dialogue.id}. ${output.length ? `[${output.join(', ')}] ` : ''}`
  }

  function formatQuestionAnswer (dialogues: Dialogue[]) {
    return dialogues.map((d) => {
      const type = d.flag & DialogueFlag.redirect ? '重定向' : '回答'
      return `${formatPrefix(d)}问题：“${d.original}”，${type}：“${formatAnswer(d.answer)}”`
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
    return sendResult('全部问答如下', formatQuestionAnswer(dialogues))
  }

  if (!options.keyword) {
    if (!question) {
      if (!dialogues.length) return meta.$send(`没有搜索到回答“${answer}”，请尝试使用关键词匹配。`)
      const output = dialogues.map(d => `${formatPrefix(d)}${d.original}`)
      return sendResult(`回答“${answer}”的问题如下`, output)
    } else if (!answer) {
      if (!dialogues.length) return meta.$send(`没有搜索到问题“${original}”，请尝试使用关键词匹配。`)
      const output = dialogues.map(d => {
        const type = d.flag & DialogueFlag.redirect ? '[重定向] ' : ''
        return `${formatPrefix(d)}${type}${formatAnswer(d.answer)}`
      })
      const totalS = dialogues.reduce((prev, curr) => prev + curr.probS, 0)
      const totalA = dialogues.reduce((prev, curr) => prev + curr.probA, 0)
      return sendResult(`问题“${original}”的回答如下`, output, dialogues.length > 1
        ? `总触发概率：p=${+totalS.toFixed(3)}, P=${+totalA.toFixed(3)}。`
        : '')
    } else {
      const [dialogue] = dialogues
      if (!dialogue) return meta.$send(`没有搜索到问答“${original}”“${answer}”，请尝试使用关键词匹配。`)
      argv.dialogues = dialogues
      await ctx.serialize('dialogue/before-detail', argv)
      return sendDetail(ctx, dialogue, argv)
    }
  }

  let output: string[]
  if (!options.autoMerge || question && answer) {
    output = formatQuestionAnswer(dialogues)
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
