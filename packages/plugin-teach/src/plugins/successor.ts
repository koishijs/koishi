import { Context } from 'koishi-core'
import { contain, union, difference, intersection } from 'koishi-utils'
import { DialogueTest, Dialogue, DialogueFlag } from '../database'
import { equal, split, TeachConfig, prepareTargets, getDialogues, isIdList } from '../utils'

declare module '../utils' {
  interface TeachConfig {
    successorTimeout?: number
  }

  interface TeachArgv {
    predecessors?: string[]
    successors?: string[]
    predOverwrite?: boolean
    succOverwrite?: boolean
  }
}

declare module '../receiver' {
  interface SessionState {
    predecessors: Record<number, number>
  }
}

declare module '../database' {
  interface DialogueTest {
    successors?: string[]
    matchAnyOf?: boolean
  }

  interface Dialogue {
    successors: string[]
  }
}

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/filter-stateless' (dialogue: Dialogue, test: DialogueTest): boolean
  }
}

export default function apply (ctx: Context, config: TeachConfig) {
  const { successorTimeout = 20000 } = config

  ctx.command('teach')
    .option('<, --set-pred <ids>', '设置前置问题', { isString: true, validate: isIdList })
    .option('<<, --add-pred <ids>', '添加前置问题', { isString: true, validate: isIdList })
    .option('>, --set-succ <ids>', '设置后继问题', { isString: true, validate: isIdList })
    .option('>>, --add-succ <ids>', '添加后继问题', { isString: true, validate: isIdList })

  ctx.on('dialogue/filter', (data, test, state) => {
    if (test.successors) {
      if (test.matchAnyOf) {
        if (!intersection(data.successors, test.successors).length) return true
      } else {
        if (!contain(data.successors, test.successors)) return true
      }
    }
    if (state && Object.keys(state.predecessors).includes('' + data.id)) return
    return ctx.bail('dialogue/filter-stateless', data, test)
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

  ctx.on('dialogue/modify', ({ succOverwrite, successors, predecessors, noContextOptions }, data) => {
    // fallback to --disable-global when there are predecessors
    if (predecessors && predecessors.length && noContextOptions) {
      if (data.groups.length) data.groups = []
      data.flag |= DialogueFlag.reversed
    }

    // merge successors
    if (!data.successors) data.successors = []
    if (!successors) return
    if (succOverwrite) {
      if (!equal(data.successors, successors)) data.successors = successors
    } else {
      if (!contain(data.successors, successors)) data.successors = union(data.successors, successors)
    }
  })

  ctx.on('dialogue/after-modify', async (argv) => {
    if (argv.options.remove) {
      argv.predOverwrite = true
      argv.predecessors = []
    }

    const { predOverwrite, predecessors, dialogues } = argv
    if (!predecessors) return
    const successors = dialogues.map(dialogue => '' + dialogue.id)
    const predDialogues = await ctx.database.getDialoguesById(predecessors)
    const newTargets = predDialogues.map(d => d.id)
    const predecessorIds = predecessors.map(Number)
    argv.unknown = difference(predecessors, newTargets.map(String))

    if (predOverwrite) {
      for (const dialogue of await getDialogues(ctx, { successors, matchAnyOf: true })) {
        if (!newTargets.includes(dialogue.id)) {
          newTargets.push(dialogue.id)
          predDialogues.push(dialogue)
        }
      }
    }

    const targets = prepareTargets(argv, predDialogues)

    for (const data of targets) {
      if (!predecessorIds.includes(data.id)) {
        data.successors = difference(data.successors, successors)
      } else if (!contain(data.successors, successors)) {
        data.successors = union(data.successors, successors)
      }
    }

    await ctx.database.setDialogues(targets, argv)
  })

  ctx.on('dialogue/detail', (dialogue, output) => {
    if (dialogue.successors.length) output.push(`后继问题：${dialogue.successors.join(', ')}`)
  })

  ctx.on('dialogue/state', (state) => {
    state.predecessors = {}
  })

  ctx.on('dialogue/after-send', (meta, dialogue, state) => {
    if (!dialogue.successors.length) return

    const time = Date.now()
    for (const id of dialogue.successors) {
      state.predecessors[id] = time
    }

    setTimeout(() => {
      const { predecessors } = state
      for (const id of dialogue.successors) {
        if (predecessors[id] === time) {
          delete predecessors[id]
        }
      }
    }, successorTimeout)
  })
}
