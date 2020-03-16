import { TeachArgv, sendDetail, getDialogues } from './utils'
import { Dialogue } from './database'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/detail-short' (dialogue: Dialogue, output: string[]): any
  }
}

function formatAnswer (source: string) {
  const lines = source.split(/(\r?\n|\$n)/g)
  const output = lines.length > 1 ? lines[0].trim() + '……' : lines[0]
  return output.replace(/\[CQ:image,[^\]]+\]/g, '[图片]')
}

export default async function (argv: TeachArgv) {
  const { ctx, meta, options, reversed, partial, groups } = argv
  const { keyword, writer, frozen, question, answer, page = 1 } = options
  const { itemsPerPage = 20, mergeThreshold = 5 } = argv.config

  const dialogues = await getDialogues(ctx, {
    writer,
    keyword,
    question,
    answer,
    reversed,
    partial,
    groups,
    frozen,
  })

  function formatPrefix (dialogue: Dialogue) {
    const output: string[] = []
    if (dialogue.probability < 1) output.push(`p=${dialogue.probability}`)
    ctx.emit('dialogue/detail-short', dialogue, output)
    return `${dialogue.id}. ${output.length ? `[${output.join(', ')}] ` : ''}`
  }

  function sendResult (title: string, output: string[]) {
    if (output.length <= itemsPerPage) {
      output.unshift(title + '：')
    } else {
      const pageCount = Math.ceil(output.length / itemsPerPage)
      output = output.slice((page - 1) * itemsPerPage, page * itemsPerPage)
      output.unshift(title + `（第 ${page}/${pageCount} 页）：`)
      output.push('可以使用 -P, --page 调整输出的条目页数。')
    }
    return meta.$send(output.join('\n'))
  }

  if (!question && !answer) {
    if (!dialogues.length) return meta.$send('没有搜索到任何回答，尝试切换到其他环境。')
    const output = dialogues.map(d => `${formatPrefix(d)}问题：“${d.original}”，回答：“${formatAnswer(d.answer)}”`)
    return sendResult('全部问答如下', output)
  }

  if (!options.keyword) {
    if (!question) {
      if (!dialogues.length) return meta.$send(`没有搜索到回答“${answer}”，请尝试使用关键词匹配。`)
      const output = dialogues.map(d => `${formatPrefix(d)}${d.original}`)
      return sendResult(`回答“${answer}”的问题如下`, output)
    } else if (!answer) {
      if (!dialogues.length) return meta.$send(`没有搜索到问题“${question}”，请尝试使用关键词匹配。`)
      const output = dialogues.map(d => `${formatPrefix(d)}${formatAnswer(d.answer)}`)
      return sendResult(`问题“${question}”的回答如下`, output)
    } else {
      const [dialogue] = dialogues
      if (!dialogue) return meta.$send(`没有搜索到问答“${question}”“${answer}”，请尝试使用关键词匹配。`)
      return sendDetail(ctx, dialogue, meta)
    }
  }

  let output: string[]
  if (!options.autoMerge || question && answer) {
    output = dialogues.map(d => `${formatPrefix(d)}问题：“${d.original}”，回答：“${formatAnswer(d.answer)}”`)
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
    if (!dialogues.length) return meta.$send(`没有搜索到含有关键词“${question}”的问题。`)
    return sendResult(`问题关键词“${question}”的搜索结果如下`, output)
  } else {
    if (!dialogues.length) return meta.$send(`没有搜索到含有关键词“${question}”“${answer}”的问答。`)
    return sendResult(`问答关键词“${question}”“${answer}”的搜索结果如下`, output)
  }
}
