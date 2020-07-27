import { Context, Meta, ParsedLine } from 'koishi-core'
import { arrayTypes } from 'koishi-database-mysql'
import { Observed, pick, difference, observe, isInteger, defineProperty, capitalize } from 'koishi-utils'

arrayTypes.push('dialogue.groups', 'dialogue.predecessors')

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/before-fetch' (test: DialogueTest, conditionals?: string[]): void
    'dialogue/fetch' (dialogue: Dialogue, test: DialogueTest): boolean | void
    'dialogue/permit' (argv: Dialogue.Argv, dialogue: Dialogue): boolean
  }
}

declare module 'koishi-core/dist/database' {
  interface TableMethods {
    dialogue: {}
  }

  interface TableData {
    dialogue: Dialogue
  }
}

type DialogueField = keyof Dialogue

type ModifyType = '添加' | '修改' | '删除'

export interface Dialogue {
  id?: number
  question: string
  answer: string
  original: string
  flag: number
  _weight?: number
  _capture?: RegExpExecArray
  _type?: ModifyType
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

export enum DialogueFlag {
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

export namespace Dialogue {
  export const history: Record<number, Dialogue> = []

  export interface Config {
    preserveHistory?: number
  }
  
  export interface Argv {
    ctx: Context
    meta: Meta<'authority' | 'id'>
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

  export async function fromIds <T extends DialogueField> (ids: number[], ctx: Context, fields?: T[]) {
    if (!ids.length) return []
    const dialogues = await ctx.database.mysql.select<Dialogue[]>('dialogue', fields, `\`id\` IN (${ids.join(',')})`)
    dialogues.forEach(d => defineProperty(d, '_backup', clone(d)))
    return dialogues
  }

  export async function fromTest (ctx: Context, test: DialogueTest) {
    let query = 'SELECT * FROM `dialogue`'
    const conditionals: string[] = []
    ctx.emit('dialogue/before-fetch', test, conditionals)
    if (conditionals.length) query += ' WHERE ' + conditionals.join(' && ')
    const dialogues = (await ctx.database.mysql.query<Dialogue[]>(query))
      .filter((dialogue) => !ctx.bail('dialogue/fetch', dialogue, test))
    dialogues.forEach(d => defineProperty(d, '_backup', clone(d)))
    return dialogues
  }

  function addHistory (dialogue: Dialogue, type: ModifyType, argv: Dialogue.Argv, revert: boolean, target = history) {
    if (revert) return delete target[dialogue.id]
    target[dialogue.id] = dialogue
    const time = Date.now()
    defineProperty(dialogue, '_timestamp', time)
    defineProperty(dialogue, '_operator', argv.meta.userId)
    defineProperty(dialogue, '_type', type)
    setTimeout(() => {
      if (history[dialogue.id]?._timestamp === time) {
        delete history[dialogue.id]
      }
    }, argv.config.preserveHistory || 600000)
  }

  export async function create (dialogue: Dialogue, argv: Dialogue.Argv, revert = false) {
    dialogue = await argv.ctx.database.mysql.create('dialogue', dialogue)
    addHistory(dialogue, '添加', argv, revert)
    return dialogue
  }

  export async function revert (dialogues: Dialogue[], argv: Dialogue.Argv) {
    const created = dialogues.filter(d => d._type === '添加')
    const edited = dialogues.filter(d => d._type !== '添加')
    await Dialogue.remove(created.map(d => d.id), argv, true)
    await Dialogue.rewrite(edited, argv)
    return `问答 ${dialogues.map(d => d.id).sort((a, b) => a - b)} 已回退完成。`
  }

  export async function rewrite (dialogues: Dialogue[], argv: Dialogue.Argv) {
    if (!dialogues.length) return
    await argv.ctx.database.mysql.update('dialogue', dialogues)
    for (const dialogue of dialogues) {
      addHistory(dialogue, '修改', argv, true)
    }
  }

  export async function update (dialogues: Observed<Dialogue>[], argv: Dialogue.Argv) {
    const data: Partial<Dialogue>[] = []
    const fields = new Set<DialogueField>(['id'])
    for (const { _diff } of dialogues) {
      for (const key in _diff) {
        fields.add(key as DialogueField)
      }
    }
    const temp: Record<number, Dialogue> = {}
    for (const dialogue of dialogues) {
      if (!Object.keys(dialogue._diff).length) {
        argv.skipped.push(dialogue.id)
      } else {
        dialogue._diff = {}
        argv.updated.push(dialogue.id)
        data.push(pick(dialogue, fields))
        addHistory(dialogue._backup, '修改', argv, false, temp)
      }
    }
    await argv.ctx.database.mysql.update('dialogue', data)
    Object.assign(history, temp)
  }

  export async function remove (ids: number[], argv: Dialogue.Argv, revert = false) {
    if (!ids.length) return
    await argv.ctx.database.mysql.query(`DELETE FROM \`dialogue\` WHERE \`id\` IN (${ids.join(',')})`)
    for (const id of ids) {
      addHistory(argv.dialogueMap[id], '删除', argv, revert)
    }
  }
}

const primitives = ['number', 'string', 'bigint', 'boolean', 'symbol']

function clone <T> (source: T): T {
  return primitives.includes(typeof source)
    ? source
    : Array.isArray(source)
    ? source.map(clone) as any
    : Object.fromEntries(Object.entries(source).map(([key, value]) => [key, clone(value)]))
}

export function sendResult (argv: Dialogue.Argv, prefix?: string, suffix?: string) {
  const { meta, options, uneditable, unknown, skipped, updated, target } = argv
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
  return meta.$send(output.join('\n'))
}

export function split (source: string) {
  if (!source) return []
  return source.split(',').flatMap((value) => {
    if (!value.includes('..')) return +value
    const capture = value.split('..')
    const start = +capture[0], end = +capture[1]
    if (end < start) return []
    return new Array(end - start + 1).fill(0).map((_, index) => start + index)
  })
}

export function equal (array1: (string | number)[], array2: (string | number)[]) {
  return array1.slice().sort().join() === array2.slice().sort().join()
}

export function prepareTargets (argv: Dialogue.Argv, dialogues = argv.dialogues) {
  const targets = dialogues.filter((dialogue) => {
    return !argv.ctx.bail('dialogue/permit', argv, dialogue)
  })
  argv.uneditable.unshift(...difference(dialogues, targets).map(d => d.id))
  return targets.map(data => observe(data, `dialogue ${data.id}`))
}

export function useFlag (ctx: Context, flag: keyof typeof DialogueFlag) {
  ctx.on('dialogue/before-fetch', (test, conditionals) => {
    if (test[flag] !== undefined) {
      conditionals.push(`!(\`flag\` & ${DialogueFlag[flag]}) = !${test[flag]}`)
    }
  })

  ctx.on('dialogue/before-search', ({ options }, test) => {
    test[flag] = options[flag]
  })

  ctx.on('dialogue/validate', ({ options }) => {
    if (options['no' + capitalize(flag)]) options[flag] = false
  })

  ctx.on('dialogue/modify', ({ options }: Dialogue.Argv, data: Dialogue) => {
    if (options[flag] !== undefined) {
      data.flag &= ~DialogueFlag[flag]
      data.flag |= +options[flag] * DialogueFlag[flag]
    }
  })
}

export function parseTeachArgs ({ args, options }: Partial<ParsedLine>) {
  function parseArgument () {
    if (!args.length) return
    const [arg] = args.splice(0, 1)
    if (!arg || arg === '~' || arg === '～') return
    return arg
  }

  defineProperty(options, 'noArgs', !args.length)
  options.question = parseArgument()
  options.answer = options.redirectDialogue || parseArgument()
}

export function isPositiveInteger (value: any) {
  return isInteger(value) && value > 0 ? '' : '应为正整数。'
}

export function isZeroToOne (value: number) {
  return value < 0 || value > 1 ? '应为不超过 1 的正数。' : ''
}

export const RE_GROUPS = /^\d+(,\d+)*$/
export const RE_DIALOGUES = /^\d+(\.\.\d+)?(,\d+(\.\.\d+)?)*$/
