import {
  App, Context, Observed, Query, Session, Tables,
  clone, defineProperty, isInteger, observe, difference, pick,
} from 'koishi'

declare module 'koishi' {
  interface App {
    teachHistory: Record<number, Dialogue>
  }

  interface EventMap {
    'dialogue/permit'(argv: Dialogue.Argv, dialogue: Dialogue): boolean
    'dialogue/flag'(flag: keyof typeof Dialogue.Flag): void
    'dialogue/test'(test: DialogueTest, query: Query.Expr<Dialogue>): void
  }

  interface Tables {
    dialogue: Dialogue
  }
}

Tables.extend('dialogue', {
  id: 'unsigned',
  flag: 'unsigned(4)',
  probS: { type: 'decimal', precision: 4, scale: 3, initial: 1 },
  probA: { type: 'decimal', precision: 4, scale: 3, initial: 0 },
  startTime: 'unsigned',
  endTime: 'unsigned',
  groups: 'list(255)',
  original: 'string(255)',
  question: 'string(255)',
  answer: 'text',
  predecessors: 'list(255)',
  successorTimeout: 'unsigned',
  writer: 'string(255)',
})

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
    /** 可访问教学系统，默认值为 2 */
    base?: number
    /** 可修改非自己创建的问答，默认值为 3 */
    admin?: number
    /** 可修改上下文设置，默认值为 3 */
    context?: number
    /** 可修改锁定的问答，默认值为 4 */
    frozen?: number
    /** 可使用正则表达式，默认值为 3 */
    regExp?: number
    /** 可设置作者或匿名，默认值为 2 */
    writer?: number
    /** 可触发教学问答，默认值为 1 */
    receive?: number
  }

  export interface Config {
    prefix?: string
    authority?: AuthorityConfig
    historyAge?: number
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

  export function get(ctx: Context, test: DialogueTest): Promise<Dialogue[]>
  export function get<K extends Field>(ctx: Context, ids: number[], fields?: K[]): Promise<Pick<Dialogue, K>[]>
  export async function get(ctx: Context, test: DialogueTest | number[], fields?: Field[]) {
    if (Array.isArray(test)) {
      const dialogues = await ctx.database.get('dialogue', test, fields)
      dialogues.forEach(d => defineProperty(d, '_backup', clone(d)))
      return dialogues
    } else {
      const query: Query.Expr<Dialogue> = { $and: [] }
      ctx.emit('dialogue/test', test, query)
      const dialogues = await ctx.database.get('dialogue', query)
      dialogues.forEach(d => defineProperty(d, '_backup', clone(d)))
      return dialogues.filter((data) => {
        if (!test.groups || test.partial) return true
        return !(data.flag & Flag.complement) === test.reversed || !equal(test.groups, data.groups)
      })
    }
  }

  export async function update(dialogues: Observed<Dialogue>[], argv: Argv) {
    const data: Partial<Dialogue>[] = []
    const fields = new Set<Field>(['id'])
    for (const { $diff } of dialogues) {
      for (const key in $diff) {
        fields.add(key as Field)
      }
    }
    for (const dialogue of dialogues) {
      if (!Object.keys(dialogue.$diff).length) {
        argv.skipped.push(dialogue.id)
      } else {
        dialogue.$diff = {}
        argv.updated.push(dialogue.id)
        data.push(pick(dialogue, fields))
        addHistory(dialogue._backup, '修改', argv, false)
      }
    }
    await argv.app.database.upsert('dialogue', data)
  }

  export async function stats(ctx: Context): Promise<Stats> {
    return ctx.database.aggregate('dialogue', {
      dialogues: { $count: 'id' },
      questions: { $count: 'question' },
    })
  }

  export async function remove(dialogues: Dialogue[], argv: Argv, revert = false) {
    const ids = dialogues.map(d => d.id)
    argv.app.database.remove('dialogue', ids)
    for (const id of ids) {
      addHistory(argv.dialogueMap[id], '删除', argv, revert)
    }
    return ids
  }

  export async function revert(dialogues: Dialogue[], argv: Argv) {
    const created = dialogues.filter(d => d._type === '添加')
    const edited = dialogues.filter(d => d._type !== '添加')
    await remove(created, argv, true)
    await recover(edited, argv)
    return `问答 ${dialogues.map(d => d.id).sort((a, b) => a - b)} 已回退完成。`
  }

  export async function recover(dialogues: Dialogue[], argv: Argv) {
    await argv.app.database.upsert('dialogue', dialogues)
    for (const dialogue of dialogues) {
      addHistory(dialogue, '修改', argv, true)
    }
  }

  export function addHistory(dialogue: Dialogue, type: ModifyType, argv: Argv, revert: boolean) {
    if (revert) return delete argv.app.teachHistory[dialogue.id]
    argv.app.teachHistory[dialogue.id] = dialogue
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
  return session.send(output.join('\n'))
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
