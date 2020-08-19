import { Context, Session, ParsedLine } from 'koishi-core'
import { difference, observe, isInteger, defineProperty } from 'koishi-utils'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/fetch'(dialogue: Dialogue, test: DialogueTest): boolean | void
    'dialogue/permit'(argv: Dialogue.Argv, dialogue: Dialogue): boolean
  }
}

declare module 'koishi-core/dist/database' {
  interface Tables {
    dialogue: Dialogue
  }
}

export interface Dialogue {
  id?: number
  question: string
  answer: string
  original: string
  flag: number
  _weight?: number
  _capture?: RegExpExecArray
  _type?: Dialogue.ModifyType
  _operator?: number
  _timestamp?: number
  _backup?: Readonly<Dialogue>
}

export interface DialogueTest {
  original?: string
  question?: string
  answer?: string
  regexp?: boolean
  activated?: boolean
  appellative?: boolean
  noRecursive?: boolean
}

export namespace Dialogue {
  export type ModifyType = '添加' | '修改' | '删除'
  export type Field = keyof Dialogue

  export const history: Record<number, Dialogue> = []

  export interface Config {
    prefix?: string
    historyAge?: number
  }

  export enum Flag {
    /** 冻结：只有 4 级以上权限者可修改 */
    frozen = 1,
    /** 正则：使用正则表达式进行匹配 */
    regexp = 2,
    /** 上下文：后继问答可以被上下文内任何人触发 */
    context = 4,
    /** 代行者：由教学者完成回答的执行 */
    substitute = 8,
    /** 补集：上下文匹配时取补集 */
    complement = 16,
  }

  export function addHistory(dialogue: Dialogue, type: Dialogue.ModifyType, argv: Dialogue.Argv, revert: boolean, target = argv.ctx.database.dialogueHistory) {
    if (revert) return delete target[dialogue.id]
    target[dialogue.id] = dialogue
    const time = Date.now()
    defineProperty(dialogue, '_timestamp', time)
    defineProperty(dialogue, '_operator', argv.session.userId)
    defineProperty(dialogue, '_type', type)
    setTimeout(() => {
      if (argv.ctx.database.dialogueHistory[dialogue.id]?._timestamp === time) {
        delete argv.ctx.database.dialogueHistory[dialogue.id]
      }
    }, argv.config.historyAge || 600000)
  }

  export interface Argv {
    ctx: Context
    session: Session<'authority' | 'id'>
    args: string[]
    config: Config
    target?: number[]
    options: Record<string, any>
    appellative?: boolean

    // modify status
    dialogues?: Dialogue[]
    dialogueMap?: Record<number, Dialogue>
    skipped?: number[]
    updated?: number[]
    unknown?: number[]
    uneditable?: number[]
  }
}

export function sendResult(argv: Dialogue.Argv, prefix?: string, suffix?: string) {
  const { session, options, uneditable, unknown, skipped, updated, target } = argv
  const { remove, revert, create } = options
  const output = []
  if (prefix) output.push(prefix)
  if (updated.length) {
    output.push(create ? `修改了已存在的问答，编号为 ${updated.join(', ')}。` : `问答 ${updated.join(', ')} 已成功修改。`)
  }
  if (skipped.length) {
    output.push(create ? `问答已存在，编号为 ${target.join(', ')}，如要修改请尝试使用 #${skipped.join(',')} 指令。` : `问答 ${skipped.join(', ')} 没有发生改动。`)
  }
  if (uneditable.length) {
    output.push(`问答 ${uneditable.join(', ')} 因权限过低无法${revert ? '回退' : remove ? '删除' : '修改'}。`)
  }
  if (unknown.length) {
    output.push(`${revert ? '最近无人修改过' : '没有搜索到'}编号为 ${unknown.join(', ')} 的问答。`)
  }
  if (suffix) output.push(suffix)
  return session.$send(output.join('\n'))
}

export function split(source: string) {
  if (!source) return []
  return source.split(',').flatMap((value) => {
    if (!value.includes('..')) return +value
    const capture = value.split('..')
    const start = +capture[0], end = +capture[1]
    if (end < start) return []
    return new Array(end - start + 1).fill(0).map((_, index) => start + index)
  })
}

export function equal(array1: (string | number)[], array2: (string | number)[]) {
  return array1.slice().sort().join() === array2.slice().sort().join()
}

export function prepareTargets(argv: Dialogue.Argv, dialogues = argv.dialogues) {
  const targets = dialogues.filter((dialogue) => {
    return !argv.ctx.bail('dialogue/permit', argv, dialogue)
  })
  argv.uneditable.unshift(...difference(dialogues, targets).map(d => d.id))
  return targets.map(data => observe(data, `dialogue ${data.id}`))
}

export function useFlag(ctx: Context, flag: keyof typeof Dialogue.Flag) {
  ctx.on('dialogue/mysql', (test, conditionals) => {
    if (test[flag] !== undefined) {
      conditionals.push(`!(\`flag\` & ${Dialogue.Flag[flag]}) = !${test[flag]}`)
    }
  })

  ctx.on('dialogue/before-search', ({ options }, test) => {
    test[flag] = options[flag]
  })

  ctx.on('dialogue/modify', ({ options }: Dialogue.Argv, data: Dialogue) => {
    if (options[flag] !== undefined) {
      data.flag &= ~Dialogue.Flag[flag]
      data.flag |= +options[flag] * Dialogue.Flag[flag]
    }
  })
}

export function parseTeachArgs({ args, options }: Partial<ParsedLine>) {
  function parseArgument() {
    if (!args.length) return
    const [arg] = args.splice(0, 1)
    if (!arg || arg === '~' || arg === '～') return
    return arg
  }

  defineProperty(options, 'noArgs', !args.length)
  options['question'] = parseArgument()
  options['answer'] = options['redirect'] || parseArgument()
}

export function isPositiveInteger(value: any) {
  return isInteger(value) && value > 0 ? '' : '应为正整数。'
}

export function isZeroToOne(value: number) {
  return value < 0 || value > 1 ? '应为不超过 1 的正数。' : ''
}

export const RE_GROUPS = /^\d+(,\d+)*$/
export const RE_DIALOGUES = /^\d+(\.\.\d+)?(,\d+(\.\.\d+)?)*$/
