import { Context, Meta, User, ParsedLine } from 'koishi-core'
import { difference, isInteger, observe } from 'koishi-utils'
import { Dialogue, DialogueTest } from './database'
import { SessionState } from './receiver'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/before-modify' (argv: TeachArgv): void | boolean | Promise<void | boolean>
    'dialogue/modify' (argv: TeachArgv, dialogue: Dialogue): void
    'dialogue/after-modify' (argv: TeachArgv): any
    'dialogue/before-detail' (argv: TeachArgv): void | Promise<void>
    'dialogue/detail' (dialogue: Dialogue, output: string[], argv: TeachArgv): void
    'dialogue/detail-short' (dialogue: Dialogue, output: string[], argv: TeachArgv): void
    'dialogue/before-search' (argv: TeachArgv, test: DialogueTest): void | boolean | Promise<void | boolean>
    'dialogue/filter' (dialogue: Dialogue, test: DialogueTest, state?: SessionState): boolean
    'dialogue/permit' (user: User, dialogue: Dialogue): boolean
  }
}

export interface TeachConfig {}

export interface TeachArgv extends Dialogue.UpdateContext {
  ctx: Context
  meta: Meta<'message'>
  args: string[]
  config: TeachConfig
  target?: number[]
  options: Record<string, any>
  appellative?: boolean

  // modify status
  dialogues?: Dialogue[]
  unknown?: number[]
  uneditable?: number[]
}

export function sendResult (argv: TeachArgv, prefix?: string, suffix?: string) {
  const output = []
  if (prefix) output.push(prefix)
  if (argv.unknown.length) {
    output.push(`没有搜索到编号为 ${argv.unknown.join(', ')} 的问答。`)
  }
  if (argv.uneditable.length) {
    output.push(`问答 ${argv.uneditable.join(', ')} 因权限过低无法修改。`)
  }
  if (argv.skipped.length) {
    output.push(`问答 ${argv.skipped.join(', ')} 没有发生改动。`)
  }
  if (argv.updated.length) {
    output.push(`问答 ${argv.updated.join(', ')} 已成功修改。`)
  }
  if (suffix) output.push(suffix)
  return argv.meta.$send(output.join('\n'))
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
  return array1.sort().join() === array2.sort().join()
}

export async function getDialogues (ctx: Context, test: DialogueTest, state?: SessionState) {
  const dialogues = await ctx.database.getDialoguesByTest(test)
  return dialogues.filter((dialogue) => {
    dialogue._weight = 1
    return !ctx.bail('dialogue/filter', dialogue, test, state)
  })
}

export function prepareTargets (argv: TeachArgv, dialogues: Dialogue[]) {
  const targets = dialogues.filter((dialogue) => {
    return !argv.ctx.bail('dialogue/permit', argv.meta.$user, dialogue)
  })
  argv.uneditable.unshift(...difference(dialogues, targets).map(d => d.id))
  return targets.map(data => observe(data, `dialogue ${data.id}`))
}

export function parseTeachArgs ({ args, options }: Partial<ParsedLine>) {
  function parseArgument () {
    if (!args.length) return
    const [arg] = args.splice(0, 1)
    if (!arg || arg === '~') return
    return arg
  }

  options.question = parseArgument()
  options.answer = options.redirectDialogue || parseArgument()
}

export function isPositiveInteger (value: any) {
  return isInteger(value) && value > 0 ? '' : '应为正整数。'
}

export function isZeroToOne (value: number) {
  return value < 0 || value > 1 ? '应为不超过 1 的正数。' : ''
}

export function isGroupIdList (value: any) {
  return !/^\d+(,\d+)*$/.test(value)
}

export function isDialogueIdList (value: any) {
  return !/^\d+(\.\.\d+)?(,\d+(\.\.\d+)?)*$/.test(value)
}
