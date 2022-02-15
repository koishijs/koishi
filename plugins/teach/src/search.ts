import { Dialogue, DialogueTest, isPositiveInteger } from './utils'
import { Context, Dict } from 'koishi'
import { getTotalWeight } from './receiver'

export interface SearchDetails extends Array<string> {
  questionType?: string
  answerType?: string
}

declare module 'koishi' {
  interface EventMap {
    'dialogue/list'(dialogue: Dialogue, output: string[], prefix: string, argv: Dialogue.Argv): void
    'dialogue/detail-short'(dialogue: Dialogue, output: SearchDetails, argv: Dialogue.Argv): void
    'dialogue/before-search'(argv: Dialogue.Argv, test: DialogueTest): void | boolean
    'dialogue/search'(argv: Dialogue.Argv, test: DialogueTest, dialogue: Dialogue[]): Promise<void>
  }
}

declare module './utils' {
  interface Dialogue {
    _redirections: Dialogue[]
  }

  namespace Dialogue {
    interface Config {
      itemsPerPage?: number
      mergeThreshold?: number
      maxAnswerLength?: number
    }

    interface Argv {
      questionMap?: Dict<Dialogue[]>
    }
  }
}

export default function apply(ctx: Context) {
  ctx.command('teach.status').action(async () => {
    const { questions, dialogues } = await ctx.teach.stats()
    return `共收录了 ${questions} 个问题和 ${dialogues} 个回答。`
  })

  ctx.command('teach')
    .option('search', '搜索已有问答', { notUsage: true })
    .option('page', '/ <page>  设置搜索结果的页码', { type: isPositiveInteger })
    .option('autoMerge', '自动合并相同的问题和回答')
    .option('recursive', '-R  禁用递归查询', { value: false })
    .option('pipe', '| <op:text>  对每个搜索结果执行操作')

  ctx.on('dialogue/execute', (argv) => {
    const { search } = argv.options
    if (search) return showSearch(argv)
  })

  ctx.on('dialogue/list', ({ _redirections }, output, prefix, argv) => {
    if (!_redirections) return
    output.push(...formatAnswers(argv, _redirections, prefix + '= '))
  })

  ctx.on('dialogue/detail-short', ({ flag }, output) => {
    if (flag & Dialogue.Flag.regexp) {
      output.questionType = '正则'
    }
  })

  ctx.before('dialogue/search', ({ options }, test) => {
    test.noRecursive = options.recursive === false
  })

  ctx.before('dialogue/search', ({ options }, test) => {
    test.appellative = options.appellative
  })

  ctx.on('dialogue/search', async (argv, test, dialogues) => {
    if (!argv.questionMap) {
      argv.questionMap = { [test.question]: dialogues }
    }
    for (const dialogue of dialogues) {
      const { answer } = dialogue
      // TODO extract dialogue command
      if (!answer.startsWith('%{dialogue ')) continue
      const { original, parsed } = argv.config._stripQuestion(answer.slice(11, -1).trimStart())
      if (parsed in argv.questionMap) continue
      // TODO multiple tests in one query
      const dialogues = argv.questionMap[parsed] = await ctx.teach.get({
        ...test,
        regexp: null,
        question: parsed,
        original: original,
      })
      Object.defineProperty(dialogue, '_redirections', { writable: true, value: dialogues })
      await argv.app.parallel('dialogue/search', argv, test, dialogues)
    }
  })
}

export function formatAnswer(source: string, { maxAnswerLength = 100 }: Dialogue.Config) {
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

export function getDetails(argv: Dialogue.Argv, dialogue: Dialogue) {
  const details: SearchDetails = []
  argv.app.emit('dialogue/detail-short', dialogue, details, argv)
  return details
}

export function formatDetails(dialogue: Dialogue, details: SearchDetails) {
  return `${dialogue.id}. ${details.length ? `[${details.join(', ')}] ` : ''}`
}

function formatPrefix(argv: Dialogue.Argv, dialogue: Dialogue, showAnswerType = false) {
  const details = getDetails(argv, dialogue)
  let result = formatDetails(dialogue, details)
  if (details.questionType) result += `[${details.questionType}] `
  if (showAnswerType && details.answerType) result += `[${details.answerType}] `
  return result
}

export function formatAnswers(argv: Dialogue.Argv, dialogues: Dialogue[], prefix = '') {
  return dialogues.map((dialogue) => {
    const { answer } = dialogue
    const output = [`${prefix}${formatPrefix(argv, dialogue, true)}${formatAnswer(answer, argv.config)}`]
    argv.app.emit('dialogue/list', dialogue, output, prefix, argv)
    return output.join('\n')
  })
}

export function formatQuestionAnswers(argv: Dialogue.Argv, dialogues: Dialogue[], prefix = '') {
  return dialogues.map((dialogue) => {
    const details = getDetails(argv, dialogue)
    const { questionType = '问题', answerType = '回答' } = details
    const { original, answer } = dialogue
    const output = [`${prefix}${formatDetails(dialogue, details)}${questionType}：${original}，${answerType}：${formatAnswer(answer, argv.config)}`]
    argv.app.emit('dialogue/list', dialogue, output, prefix, argv)
    return output.join('\n')
  })
}

async function showSearch(argv: Dialogue.Argv) {
  const { app, session, options, args: [question, answer] } = argv
  const { regexp, page = 1, original, pipe, recursive, autoMerge } = options
  const { itemsPerPage = 30, mergeThreshold = 5 } = argv.config

  const test: DialogueTest = { question, answer, regexp, original }
  if (app.bail('dialogue/before-search', argv, test)) return ''
  const dialogues = await argv.app.teach.get(test)

  if (pipe) {
    if (!dialogues.length) return '没有搜索到任何问答。'
    const command = app.command('teach')
    const argv = { ...command.parse(pipe), session, command }
    const target = argv.options['target'] = dialogues.map(d => d.id).join(',')
    argv.source = `#${target} ${pipe}`
    return command.execute(argv)
  }

  if (recursive !== false && !autoMerge) {
    await argv.app.parallel('dialogue/search', argv, test, dialogues)
  }

  if (!original && !answer) {
    if (!dialogues.length) return '没有搜索到任何回答，尝试切换到其他环境。'
    return sendResult('全部问答如下', formatQuestionAnswers(argv, dialogues))
  }

  if (!options.regexp) {
    const suffix = options.regexp !== false ? '，请尝试使用正则表达式匹配' : ''
    if (!original) {
      if (!dialogues.length) return `没有搜索到回答“${answer}”${suffix}。`
      const output = dialogues.map(d => `${formatPrefix(argv, d)}${d.original}`)
      return sendResult(`回答“${answer}”的问题如下`, output)
    } else if (!answer) {
      if (!dialogues.length) return `没有搜索到问题“${original}”${suffix}。`
      const output = formatAnswers(argv, dialogues)
      const state = app.getSessionState(session)
      state.isSearch = true
      state.test = test
      state.dialogues = dialogues
      const total = await getTotalWeight(app, state)
      return sendResult(`问题“${original}”的回答如下`, output, dialogues.length > 1 ? `实际触发概率：${+Math.min(total, 1).toFixed(3)}` : '')
    } else {
      if (!dialogues.length) return `没有搜索到问答“${original}”“${answer}”${suffix}。`
      const output = [dialogues.map(d => d.id).join(', ')]
      return sendResult(`“${original}”“${answer}”匹配的回答如下`, output)
    }
  }

  let output: string[]
  if (!autoMerge || question && answer) {
    output = formatQuestionAnswers(argv, dialogues)
  } else {
    const idMap: Dict<number[]> = {}
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

  if (!original) {
    if (!dialogues.length) return `没有搜索到含有正则表达式“${answer}”的回答。`
    return sendResult(`回答正则表达式“${answer}”的搜索结果如下`, output)
  } else if (!answer) {
    if (!dialogues.length) return `没有搜索到含有正则表达式“${original}”的问题。`
    return sendResult(`问题正则表达式“${original}”的搜索结果如下`, output)
  } else {
    if (!dialogues.length) return `没有搜索到含有正则表达式“${original}”“${answer}”的问答。`
    return sendResult(`问答正则表达式“${original}”“${answer}”的搜索结果如下`, output)
  }

  function sendResult(title: string, output: string[], suffix?: string) {
    if (output.length <= itemsPerPage) {
      output.unshift(title + '：')
      if (suffix) output.push(suffix)
    } else {
      const pageCount = Math.ceil(output.length / itemsPerPage)
      output = output.slice((page - 1) * itemsPerPage, page * itemsPerPage)
      output.unshift(title + `（第 ${page}/${pageCount} 页）：`)
      if (suffix) output.push(suffix)
      output.push('可以使用 /+页码 以调整输出的条目页数。')
    }
    return output.join('\n')
  }
}
