import { Context, Meta, User } from 'koishi-core'
import { difference, isInteger } from 'koishi-utils'
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

export interface TeachArgv {
  ctx: Context
  meta: Meta<'message'>
  args: string[]
  config: TeachConfig
  target?: string[]
  options: Record<string, any>

  // modify status
  dialogues?: Dialogue[]
  unknown?: string[]
  uneditable?: number[]
  updated?: number[]
  skipped?: number[]
  failed?: number[]
}

export function sendResult (argv: TeachArgv, message?: string) {
  const output = message ? [message] : []
  if (argv.unknown.length) {
    output.push(`没有搜索到编号为 ${argv.unknown.join(', ')} 的问答。`)
  }
  if (argv.uneditable.length) {
    output.push(`问答 ${argv.uneditable.join(', ')} 因权限过低无法修改。`)
  }
  if (argv.failed.length) {
    output.push(`问答 ${argv.failed.join(', ')} 修改时发生错误。`)
  }
  if (argv.skipped.length) {
    output.push(`问答 ${argv.skipped.join(', ')} 没有发生改动。`)
  }
  if (argv.updated.length) {
    output.push(`问答 ${argv.updated.join(', ')} 已成功修改。`)
  }
  return argv.meta.$send(output.join('\n'))
}

export function split (source: string) {
  return source ? source.split(',') : []
}

export function equal (array1: string[], array2: string[]) {
  return array1.sort().join() === array2.sort().join()
}

export async function getDialogues (ctx: Context, test: DialogueTest, state?: SessionState) {
  const dialogues = await ctx.database.getDialoguesByTest(test)
  return dialogues.filter((dialogue) => {
    return !ctx.bail('dialogue/filter', dialogue, test, state)
  })
}

export function checkAuthority (argv: TeachArgv, dialogues: Dialogue[]) {
  const targets = dialogues.filter((dialogue) => {
    return !argv.ctx.bail('dialogue/permit', argv.meta.$user, dialogue)
  })
  argv.uneditable.unshift(...difference(dialogues, targets).map(d => d.id))
  return targets
}

export async function sendDetail (ctx: Context, dialogue: Dialogue, argv: TeachArgv) {
  const output = [`编号为 ${dialogue.id} 的问答信息：`]
  ctx.emit('dialogue/detail', dialogue, output, argv)
  await argv.meta.$send(output.join('\n'))
}

export function isPositiveInteger (value: any) {
  return isInteger(value) && value > 0 ? '' : '应为正整数。'
}

export function isZeroToOne (value: number) {
  return value < 0 || value > 1 ? '应为不超过 1 的正数。' : ''
}

export function isIdList (value: any) {
  return !/^\d+(,\d+)*$/.test(value)
}
