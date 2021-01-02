import { Session, Argv, App } from 'koishi-core'
import { difference, observe, isInteger, defineProperty, Observed } from 'koishi-utils'
import { RegExpValidator } from 'regexpp'

declare module 'koishi-core/dist/app' {
  interface App {
    teachHistory: Record<number, Dialogue>
  }
}

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/permit'(argv: Dialogue.Argv, dialogue: Dialogue): boolean
    'dialogue/flag'(flag: keyof typeof Dialogue.Flag): void
  }
}

declare module 'koishi-core/dist/database' {
  interface Tables {
    dialogue: Dialogue
  }

  interface Database {
    getDialoguesById<T extends Dialogue.Field>(ids: number[], fields?: T[]): Promise<Dialogue[]>
    getDialoguesByTest(test: DialogueTest): Promise<Dialogue[]>
    createDialogue(dialogue: Dialogue, argv: Dialogue.Argv, revert?: boolean): Promise<Dialogue>
    removeDialogues(ids: number[], argv: Dialogue.Argv, revert?: boolean): Promise<void>
    updateDialogues(dialogues: Observed<Dialogue>[], argv: Dialogue.Argv): Promise<void>
    revertDialogues(dialogues: Dialogue[], argv: Dialogue.Argv): Promise<string>
    recoverDialogues(dialogues: Dialogue[], argv: Dialogue.Argv): Promise<void>
    getDialogueStats(): Promise<DialogueStats>
  }
}

interface DialogueStats {
  questions: number
  dialogues: number
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

  export interface AuthorityConfig {
    base?: number
    admin?: number
    context?: number
    frozen?: number
    regExp?: number
    writer?: number
  }

  export interface Config {
    prefix?: string
    authority?: AuthorityConfig
    historyAge?: number
    validateRegExp?: RegExpValidator.Options
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

  export function addHistory(dialogue: Dialogue, type: Dialogue.ModifyType, argv: Dialogue.Argv, revert: boolean, target = argv.app.teachHistory) {
    if (revert) return delete target[dialogue.id]
    target[dialogue.id] = dialogue
    const time = Date.now()
    defineProperty(dialogue, '_timestamp', time)
    defineProperty(dialogue, '_operator', argv.session.userId)
    defineProperty(dialogue, '_type', type)
    setTimeout(() => {
      if (argv.app.teachHistory[dialogue.id]?._timestamp === time) {
        delete argv.app.teachHistory[dialogue.id]
      }
    }, argv.config.historyAge ?? 600000)
  }

  export interface Argv {
    app: App
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
  const { session, options, uneditable, unknown, skipped, updated, target, config } = argv
  const { remove, revert, create } = options
  const output = []
  if (prefix) output.push(prefix)
  if (updated.length) {
    output.push(create ? `修改了已存在的问答，编号为 ${updated.join(', ')}。` : `问答 ${updated.join(', ')} 已成功修改。`)
  }
  if (skipped.length) {
    output.push(create ? `问答已存在，编号为 ${target.join(', ')}，如要修改请尝试使用 ${config.prefix}${skipped.join(',')} 指令。` : `问答 ${skipped.join(', ')} 没有发生改动。`)
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
    return !argv.app.bail('dialogue/permit', argv, dialogue)
  })
  argv.uneditable.unshift(...difference(dialogues, targets).map(d => d.id))
  return targets.map(data => observe(data, `dialogue ${data.id}`))
}

export function parseTeachArgs({ args, options }: Partial<Argv>) {
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
