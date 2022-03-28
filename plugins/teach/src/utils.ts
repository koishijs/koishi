import { App, difference, isInteger, observe, Query, Session } from 'koishi'

declare module 'koishi' {
  interface EventMap {
    'dialogue/permit'(argv: Dialogue.Argv, dialogue: Dialogue): boolean
    'dialogue/flag'(flag: keyof typeof Dialogue.Flag): void
    'dialogue/test'(test: DialogueTest, query: Query.Expr<Dialogue>): void
  }

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
  _operator?: string
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

  export interface Config {
    historyTimeout?: number
  }

  export interface Stats {
    questions: number
    dialogues: number
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

  export interface Argv {
    app: App
    session: Session<'authority' | 'id'>
    args: string[]
    config: Config
    target?: number[]
    options: Record<string, any>

    // modify status
    dialogues?: Dialogue[]
    dialogueMap?: Record<number, Dialogue>
    skipped?: number[]
    updated?: number[]
    unknown?: number[]
    uneditable?: number[]
  }
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
    return !argv.app.bail('dialogue/permit', argv, dialogue)
  })
  argv.uneditable.unshift(...difference(dialogues, targets).map(d => d.id))
  return targets.map(data => observe(data, `dialogue ${data.id}`))
}

export function isPositiveInteger(source: string) {
  const n = +source
  if (isInteger(n) && n > 0) return n
  throw new Error('应为正整数。')
}

export function isZeroToOne(source: string) {
  const n = +source
  if (n >= 0 && n <= 1) return n
  throw new Error('应为不超过 1 的正数。')
}

export const RE_DIALOGUES = /^\d+(\.\.\d+)?(,\d+(\.\.\d+)?)*$/
