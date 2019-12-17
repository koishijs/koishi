import { TeachOptions } from './utils'

function formatAnswer (source: string) {
  const lines = source.split(/(\r?\n|\$n)/g)
  const output = lines.length > 1 ? lines[0].trim() + '……' : lines[0]
  return output.replace(/\[CQ:image,[^\]]+\]/g, '[图片]')
}

export default async function (parsedOptions: TeachOptions) {
  const { ctx, meta, options } = parsedOptions
  const question = options.all ? undefined : options.question
  const answer = options.all ? undefined : options.answer
  let { envMode, groups, writer } = parsedOptions
  const { keyword } = options
  if (!envMode && !options.allEnv) {
    envMode = 1
    groups = [meta.groupId]
  }
  const dialogues = await ctx.database.getDialogues({
    writer,
    keyword,
    question,
    answer,
    envMode,
    groups,
    frozen: options.unFrozen ? false : options.frozen,
  })
  if (!options.question && !options.answer) {
    if (!dialogues.length) return meta.$send('没有搜索到任何回答，尝试切换到其他环境。')
    const output = dialogues.map(({ id, question, answer }) => `${id}. 问题：“${question}”，回答：“${formatAnswer(answer)}”`)
    output.unshift('全部问答如下：')
    return meta.$send(output.join('\n'))
  }
  if (!options.keyword) {
    if (!options.question) {
      if (!dialogues.length) return meta.$send(`没有搜索到回答“${answer}”，请尝试使用关键词匹配。`)
      const output = dialogues.map(({ id, question }) => `${id}. ${question}`)
      output.unshift(`回答“${answer}”的问题如下：`)
      return meta.$send(output.join('\n'))
    } else if (!options.answer) {
      if (!dialogues.length) return meta.$send(`没有搜索到问题“${question}”，请尝试使用关键词匹配。`)
      const output = dialogues.map(({ id, answer }) => `${id}. ${formatAnswer(answer)}`)
      output.unshift(`问题“${question}”的回答如下：`)
      return meta.$send(output.join('\n'))
    } else {
      if (!dialogues.length) return meta.$send(`没有搜索到问答“${question}”“${answer}”，请尝试使用关键词匹配。`)
      return meta.$send(`问答“${question}”“${answer}”的编号为：${dialogues.map(({ id }) => id).join(', ')}。`)
    }
  } else {
    const output = dialogues.map(({ id, question, answer }) => `${id}. 问题：“${question}”，回答：“${formatAnswer(answer)}”`)
    if (!options.question) {
      if (!dialogues.length) return meta.$send(`没有搜索到含有关键词“${answer}”的的回答。`)
      output.unshift(`回答关键词“${answer}”的搜索结果如下：`)
    } else if (!options.answer) {
      if (!dialogues.length) return meta.$send(`没有搜索到含有关键词“${question}”的的问题。`)
      output.unshift(`问题关键词“${question}”的搜索结果如下：`)
    } else {
      if (!dialogues.length) return meta.$send(`没有搜索到含有关键词“${question}”“${answer}”的的问答。`)
      output.unshift(`问答关键词“${question}”“${answer}”的搜索结果如下：`)
    }
    return meta.$send(output.join('\n'))
  }
}
