import { Context } from 'koishi-core'
import { contain, union, difference } from 'koishi-utils'
import { equal, split, TeachConfig, prepareTargets, getDialogues, isDialogueIdList, parseTeachArgs, isPositiveInteger } from '../utils'
import { Dialogue, DialogueFlag } from '../database'
import { formatQuestionAnswers } from '../search'

declare module '../utils' {
  interface TeachConfig {
    successorTimeout?: number
  }

  interface TeachArgv {
    predecessors?: number[]
    successors?: number[]
    predOverwrite?: boolean
    succOverwrite?: boolean
  }
}

declare module '../receiver' {
  interface SessionState {
    predecessors: Record<number, Record<number, number>>
  }
}

declare module '../database' {
  interface DialogueTest {
    stateful?: boolean
    indefinite?: boolean
    predecessors?: (string | number)[]
  }

  interface Dialogue {
    predecessors: string[]
    successorTimeout: number
    _predecessors: Dialogue[]
    _successors: Dialogue[]
  }
}

export default function apply (ctx: Context, config: TeachConfig) {
  const { successorTimeout = 20000 } = config

  ctx.command('teach')
    .option('<, --set-pred <ids>', '设置前置问题', { isString: true, validate: isDialogueIdList })
    .option('<<, --add-pred <ids>', '添加前置问题', { isString: true, validate: isDialogueIdList })
    .option('>, --set-succ <ids>', '设置后继问题', { isString: true, validate: isDialogueIdList })
    .option('>>, --add-succ <ids>', '添加后继问题', { isString: true, validate: isDialogueIdList })
    .option('>#, --create-successor <op...>', '创建并添加后继问答')
    .option('-z, --successor-timeout [time]', '设置允许触发后继的时间', { validate: isPositiveInteger })
    .option('-i, --indefinite', '允许后继问答被任何人触发')
    .option('-I, --no-indefinite', '后继问答只能被同一人触发')

  ctx.on('dialogue/before-fetch', ({ predecessors, stateful, noRecursive, indefinite }, conditionals) => {
    if (noRecursive) {
      conditionals.push('!`predecessors`')
    } else if (predecessors !== undefined) {
      const segments = predecessors.map(id => `FIND_IN_SET(${id}, \`predecessors\`)`)
      if (stateful) {
        conditionals.push(`(${['!`predecessors`', ...segments].join('||')})`)
      } else if (predecessors.length) {
        conditionals.push(`(${segments.join('||')})`)
      }
    }

    if (indefinite) {
      conditionals.push(`(\`flag\` & ${DialogueFlag.indefinite})`)
    } else if (indefinite === false) {
      conditionals.push(`!(\`flag\` & ${DialogueFlag.indefinite})`)
    }
  })

  ctx.on('dialogue/validate', (argv) => {
    const { options, meta } = argv

    if (options.noIndefinite) options.indefinite = false

    if ('setPred' in options) {
      if ('addPred' in options) {
        return meta.$send('选项 --set-pred, --add-pred 不能同时使用。')
      } else {
        argv.predecessors = split(options.setPred)
        argv.predOverwrite = true
      }
    } else if ('addPred' in options) {
      argv.predecessors = split(options.addPred)
      argv.predOverwrite = false
    }

    if ('setSucc' in options) {
      if ('addSucc' in options) {
        return meta.$send('选项 --set-succ, --add-succ 不能同时使用。')
      } else {
        argv.successors = split(options.setSucc)
        argv.succOverwrite = true
      }
    } else if ('addSucc' in options) {
      argv.successors = split(options.addSucc)
      argv.succOverwrite = false
    }
  })

  ctx.on('dialogue/modify', ({ predOverwrite, predecessors }, data) => {
    // merge predecessors
    if (!data.predecessors) data.predecessors = []
    if (!predecessors) return
    if (predOverwrite) {
      if (!equal(data.predecessors, predecessors)) data.predecessors = predecessors.map(String)
    } else {
      if (!contain(data.predecessors, predecessors)) data.predecessors = union(data.predecessors, predecessors.map(String))
    }
  })

  ctx.on('dialogue/modify', ({ options }, data) => {
    // set successor timeout
    if (options.successorTimeout) {
      data.successorTimeout = options.successorTimeout * 1000
    }

    if (options.indefinite !== undefined) {
      data.flag &= ~DialogueFlag.indefinite
      data.flag |= +options.indefinite * DialogueFlag.indefinite
    }
  })

  ctx.on('dialogue/after-modify', async (argv) => {
    // modify successors
    const { succOverwrite, successors, dialogues } = argv
    if (!successors) return
    const predecessors = dialogues.map(dialogue => '' + dialogue.id)
    const successorDialogues = await Dialogue.fromIds(successors, argv.ctx)
    const newTargets = successorDialogues.map(d => d.id)
    argv.unknown = difference(successors, newTargets)

    if (succOverwrite) {
      for (const dialogue of await getDialogues(ctx, { predecessors })) {
        if (!newTargets.includes(dialogue.id)) {
          newTargets.push(dialogue.id)
          successorDialogues.push(dialogue)
        }
      }
    }

    const targets = prepareTargets(argv, successorDialogues)

    for (const data of targets) {
      if (!successors.includes(data.id)) {
        data.predecessors = difference(data.predecessors, predecessors)
      } else if (!contain(data.predecessors, predecessors)) {
        data.predecessors = union(data.predecessors, predecessors)
      }
    }

    await Dialogue.update(targets, argv)
  })

  ctx.on('dialogue/after-modify', async ({ options, dialogues, meta }) => {
    // ># shortcut
    if (!options.createSuccessor) return
    if (!dialogues.length) return meta.$send('没有搜索到任何问答。')
    const command = ctx.getCommand('teach', meta)
    parseTeachArgs(Object.assign(meta.$argv, command.parse(options.createSuccessor)))
    meta.$argv.options.setPred = dialogues.map(d => d.id).join(',')
    await command.execute(meta.$argv)
  })

  // get predecessors
  ctx.on('dialogue/before-detail', async ({ options, dialogues, ctx }) => {
    if (Object.keys(options).length) return
    const predecessors = new Set<number>()
    for (const dialogue of dialogues) {
      for (const id of dialogue.predecessors) {
        predecessors.add(+id)
      }
    }
    const dialogueMap: Record<string, Dialogue> = {}
    for (const dialogue of await Dialogue.fromIds([...predecessors], ctx)) {
      dialogueMap[dialogue.id] = dialogue
    }
    for (const dialogue of dialogues) {
      const predecessors = dialogue.predecessors.map(id => dialogueMap[id] || { id })
      Object.defineProperty(dialogue, '_predecessors', { writable: true, value: predecessors })
    }
  })

  // get successors
  ctx.on('dialogue/before-detail', async ({ options, dialogues }) => {
    if (Object.keys(options).length) return
    await attachSuccessors(dialogues)
  })

  async function attachSuccessors (dialogues: Dialogue[], dialogueMap: Record<number, Dialogue> = {}) {
    const predecessors = dialogues.filter((dialogue) => {
      if (dialogueMap[dialogue.id]) return
      dialogueMap[dialogue.id] = dialogue
      Object.defineProperty(dialogue, '_successors', { writable: true, value: [] })
      return true
    }).map(d => d.id)
    if (!predecessors.length) return []
    const successors = await getDialogues(ctx, { predecessors })
    for (const dialogue of successors) {
      if (predecessors.includes(dialogue.id)) continue
      for (const id of dialogue.predecessors) {
        if (id in dialogueMap) {
          dialogueMap[id]._successors.push(dialogue)
        }
      }
    }
    return successors
  }

  ctx.on('dialogue/detail', async (dialogue, output, argv) => {
    if (dialogue.flag & DialogueFlag.indefinite) {
      output.push('后继问答可以被上下文内任何人触发')
    }
    if ((dialogue.successorTimeout || successorTimeout) !== successorTimeout) {
      output.push(`可触发后继时间：${dialogue.successorTimeout / 1000} 秒`)
    }
    if (dialogue._predecessors.length) {
      output.push('前置问答：', ...formatQuestionAnswers(argv, dialogue._predecessors))
    }
    if (dialogue._successors.length) {
      output.push('后继问答：', ...formatQuestionAnswers(argv, dialogue._successors))
    }
  })

  ctx.on('dialogue/detail-short', (dialogue, output) => {
    if ((dialogue.successorTimeout || successorTimeout) !== successorTimeout) {
      output.push(`z=${dialogue.successorTimeout / 1000}`)
    }
    if (dialogue.predecessors.length) output.push(`存在前置`)
    if (dialogue.flag & DialogueFlag.indefinite) {
      output.push('上下文后置')
    }
  })

  ctx.on('dialogue/before-search', ({ options }, test) => {
    test.indefinite = options.indefinite
  })

  ctx.on('dialogue/search', async (argv, test, dialogues) => {
    if (!argv.dialogueMap) argv.dialogueMap = {}
    while ((dialogues = await attachSuccessors(dialogues, argv.dialogueMap)).length) {}
  })

  ctx.on('dialogue/list', ({ _successors }, output, prefix, argv) => {
    if (!_successors) return
    output.push(...formatQuestionAnswers(argv, _successors, prefix + '> '))
  })

  ctx.on('dialogue/state', (state) => {
    state.predecessors = {}
  })

  ctx.on('dialogue/receive', ({ test, predecessors, userId }) => {
    test.stateful = true
    test.predecessors = Object.keys({
      ...predecessors[0],
      ...predecessors[userId],
    })
  })

  ctx.on('dialogue/prepare', ({ dialogues, isSearch }) => {
    if (isSearch) {
      // 搜索模式下，存在前置的问答不计权重
      for (const dialogue of dialogues) {
        if (dialogue.predecessors.length) dialogue._weight = 0
      }
    } else if (dialogues.some(d => d.predecessors.length)) {
      // 正常情况下，如果已有存在前置的问答，则优先触发
      for (const dialogue of dialogues) {
        if (!dialogue.predecessors.length) dialogue._weight = 0
      }
    }
  })

  ctx.on('dialogue/before-send', ({ dialogue, predecessors, userId }) => {
    const time = Date.now()
    if (dialogue.flag & DialogueFlag.indefinite) userId = 0
    const predMap = predecessors[userId] || (predecessors[userId] = {})
    for (const id of dialogue.predecessors) {
      delete predMap[id]
    }
    predMap[dialogue.id] = time
    setTimeout(() => {
      if (predMap[dialogue.id] === time) {
        delete predMap[dialogue.id]
      }
    }, dialogue.successorTimeout || successorTimeout)
  })
}
