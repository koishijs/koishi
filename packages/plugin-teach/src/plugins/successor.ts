import { Context } from 'koishi-core'
import { contain, union, difference } from 'koishi-utils'
import { equal, split, TeachConfig, prepareTargets, getDialogues, isDialogueIdList, parseTeachArgs } from '../utils'

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
    predecessors?: string[]
  }

  interface Dialogue {
    predecessors: string[]
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

  ctx.on('dialogue/before-fetch', ({ predecessors }, conditionals) => {
    if (predecessors !== undefined) {
      conditionals.push(`(${[
        '!`predecessors`',
        ...predecessors.map(id => `FIND_IN_SET(${id}, \`predecessors\`)`),
      ].join('||')})`)
    }
  })

  ctx.on('dialogue/validate', (argv) => {
    const { options, meta } = argv

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

  ctx.on('dialogue/after-modify', async (argv) => {
    // modify successors
    const { succOverwrite, successors, dialogues } = argv
    if (!successors) return
    const predecessors = dialogues.map(dialogue => '' + dialogue.id)
    const successorDialogues = await ctx.database.getDialoguesById(successors)
    const newTargets = successorDialogues.map(d => d.id)
    argv.unknown = difference(successors, newTargets)

    if (succOverwrite) {
      for (const dialogue of await getDialogues(ctx, { predecessors: predecessors })) {
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

    await ctx.database.setDialogues(targets, argv)
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

  ctx.on('dialogue/detail', (dialogue, output) => {
    if (dialogue.predecessors.length) output.push(`前置问答：${dialogue.predecessors.join(', ')}`)
  })

  ctx.on('dialogue/detail-short', (dialogue, output) => {
    if (dialogue.predecessors.length) output.push(`存在前置`)
  })

  ctx.on('dialogue/state', (state) => {
    state.predecessors = {}
  })

  ctx.on('dialogue/receive', ({ test, predecessors, userId }) => {
    test.predecessors = Object.keys(predecessors[userId] || {})
  })

  ctx.on('dialogue/before-attach-user', ({ dialogues, isSearch }) => {
    if (!isSearch) return
    for (const dialogue of dialogues) {
      if (dialogue.predecessors.length) dialogue._weight = 0
    }
  })

  ctx.on('dialogue/before-send', ({ dialogue, predecessors, userId }) => {
    const time = Date.now()
    const predMap = predecessors[userId] || (predecessors[userId] = {})
    for (const id of dialogue.predecessors) {
      delete predMap[id]
    }
    predMap[dialogue.id] = time
    setTimeout(() => {
      if (predMap[dialogue.id] === time) {
        delete predMap[dialogue.id]
      }
    }, successorTimeout)
  })
}
