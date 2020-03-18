import { Context, Meta, User } from 'koishi-core'
import { simplify, difference } from 'koishi-utils'
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

export interface TeachConfig {
  key?: string
  imageServer?: string
  uploadServer?: string
}

const prefixPunctuation = /^([()\]]|\[(?!cq:))*/
const suffixPunctuation = /([.,?!()[~]|(?<!\[cq:[^\]]+)\])*$/

export function stripPunctuation (source: string) {
  source = source.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/，/g, ',')
    .replace(/、/g, ',')
    .replace(/。/g, '.')
    .replace(/？/g, '?')
    .replace(/！/g, '!')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/【/g, '[')
    .replace(/】/g, ']')
    .replace(/～/g, '~')
  return source
    .replace(prefixPunctuation, '')
    .replace(suffixPunctuation, '') || source
}

export function simplifyQuestion (source: string) {
  return simplify(stripPunctuation(String(source || '')))
}

export function simplifyAnswer (source: string) {
  return (String(source || '')).trim()
}

export function deleteDuplicate <T> (array: T[]) {
  return [...new Set(array)]
}

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

export function idSplit (source: string) {
  return source ? source.split(',') : []
}

export function idEqual (array1: string[], array2: string[]) {
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
  const output = [
    `编号为 ${dialogue.id} 的问答信息：`,
    `问题：${dialogue.original}`,
    `回答：${dialogue.answer}`,
  ]

  if (dialogue.probability < 1) output.push(`触发权重：${dialogue.probability}`)
  ctx.emit('dialogue/detail', dialogue, output, argv)

  await argv.meta.$send(output.join('\n'))
}
