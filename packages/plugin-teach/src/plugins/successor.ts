import { Context } from 'koishi-core'
import { contain, union, difference, intersection } from 'koishi-utils'
import { DialogueTest, Dialogue } from '../database'
import { equal, split, TeachConfig, checkAuthority, getDialogues } from '../utils'

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
    .option('--set-pred <ids>', '设置前置问题 (<<)', { isString: true, hidden: true })
    .option('--add-pred <ids>', '添加前置问题 (<)', { isString: true, hidden: true })
    .option('--set-succ <ids>', '设置后继问题 (>>)', { isString: true, hidden: true })
    .option('--add-succ <ids>', '添加后继问题 (>)', { isString: true, hidden: true })

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
    function parseOption (key: string, fullname: string, prop = key) {
      if (/^\d+(,\d+)*$/.test(options[key])) {
        argv[prop] = split(options[key])
      } else {
        return meta.$send(`参数 ${fullname} 错误，请检查指令语法。`)
      }
    }

    let errorPromise: Promise<void>

    if ('setPred' in options) {
      if ('addPred' in options) {
        return meta.$send('选项 --set-pred, --add-pred 不能同时使用。')
      } else {
        if (errorPromise = parseOption('setPred', '--set-pred', 'predecessors')) return errorPromise
        argv.predOverwrite = true
      }
    } else if ('addPred' in options) {
      if (errorPromise = parseOption('addPred', '--add-pred', 'predecessors')) return errorPromise
      argv.predOverwrite = false
    }

    if ('setSucc' in options) {
      if ('addSucc' in options) {
        return meta.$send('选项 --set-succ, --add-succ 不能同时使用。')
      } else {
        if (errorPromise = parseOption('setSucc', '--set-succ', 'successors')) return errorPromise
        argv.succOverwrite = true
      }
    } else if ('addSucc' in options) {
      if (errorPromise = parseOption('addSucc', '--add-succ', 'successors')) return errorPromise
      argv.succOverwrite = false
    }
  })

  ctx.on('dialogue/modify', ({ succOverwrite, successors }, data) => {
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

    const { predOverwrite, predecessors, dialogues, skipped, updated, failed } = argv
    if (!predecessors) return
    const successors = dialogues.map(dialogue => '' + dialogue.id)
    const predDialogues = await ctx.database.getDialogues(predecessors)
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

    const targets = checkAuthority(argv, predDialogues)

    for (const data of targets) {
      if (predecessorIds.includes(data.id)) {
        if (contain(data.successors, successors)) {
          skipped.push(data.id)
          continue
        } else {
          data.successors = union(data.successors, successors)
        }
      } else {
        data.successors = difference(data.successors, successors)
      }

      try {
        const { id, successors } = data
        await ctx.database.setDialogue(id, { successors })
        updated.push(id)
      } catch (error) {
        failed.push(data.id)
      }
    }
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
