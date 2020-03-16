import { Context, Meta } from 'koishi-core'
import { simplify, contain, union, difference } from 'koishi-utils'
import { Dialogue, DialogueTest, DialogueFlag } from './database'
import { SessionState } from './receiver'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/before-modify' (argv: TeachArgv): any
    'dialogue/modify' (argv: TeachArgv, dialogue: Dialogue): any
    'dialogue/detail' (dialogue: Dialogue, output: string[]): any
    'dialogue/filter' (dialogue: Dialogue, test: DialogueTest, state?: SessionState): boolean
  }
}

export interface ThrottleConfig {
  interval: number
  responses: number
}

export interface LoopConfig {
  participants: number
  length: number
}

export interface TeachConfig {
  key?: string
  imageServer?: string
  uploadServer?: string
  itemsPerPage?: number
  successorTimeout?: number
  preventLoop?: number | LoopConfig | LoopConfig[]
  throttle?: ThrottleConfig | ThrottleConfig[]
  mergeThreshold?: number
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

export interface TeachOptions {
  original?: string
  question?: string
  answer?: string
  remove?: boolean
  frozen?: boolean
  keyword?: boolean
  autoMerge?: boolean
  writer?: number
  page?: number
  probability?: number
}

export interface TeachArgv {
  ctx: Context
  meta: Meta<'message'>
  args: string[]
  config: TeachConfig
  groups?: string[]
  partial?: boolean
  reversed?: boolean
  target?: string[]
  predecessors?: string[]
  successors?: string[]
  predOverwrite?: boolean
  succOverwrite?: boolean
  options: TeachOptions
}

export function deleteDuplicate <T> (array: T[]) {
  return [...new Set(array)]
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

export function modifyDialogue (data: Dialogue, argv: TeachArgv) {
  const { ctx, partial, reversed, groups, options, successors, succOverwrite } = argv

  if (groups) {
    if (partial) {
      const newGroups = !(data.flag & DialogueFlag.reversed) === reversed
        ? difference(data.groups, groups)
        : union(data.groups, groups)
      if (!idEqual(data.groups, newGroups)) {
        data.groups = newGroups
      }
    } else {
      data.flag = data.flag & ~DialogueFlag.reversed | (+reversed * DialogueFlag.reversed)
      if (!idEqual(data.groups, groups)) {
        data.groups = groups.slice()
      }
    }
  }

  if (options.answer) {
    data.answer = options.answer
  }

  if (options.question) {
    data.question = options.question
    data.original = options.original
  }

  if (options.writer !== undefined) data.writer = options.writer
  if (options.probability !== undefined) data.probability = options.probability

  ctx.emit('dialogue/modify', argv, data)

  if (options.keyword !== undefined) {
    data.flag &= ~DialogueFlag.keyword
    data.flag |= +options.keyword * DialogueFlag.keyword
  }

  if (options.frozen !== undefined) {
    data.flag &= ~DialogueFlag.frozen
    data.flag |= +options.frozen * DialogueFlag.frozen
  }

  if (successors) {
    if (succOverwrite) {
      if (!idEqual(data.successors, successors)) data.successors = successors
    } else {
      if (!contain(data.successors, successors)) data.successors = union(data.successors, successors)
    }
  }
}

export function checkAuthority (meta: Meta, dialogues: Dialogue[]) {
  const predicate: (dialogue: Dialogue) => boolean =
    meta.$user.authority > 3 ? () => true :
      meta.$user.authority > 2 ? d => !(d.flag & DialogueFlag.frozen) :
        d => !(d.flag & DialogueFlag.frozen) && (!d.writer || d.writer === meta.userId)
  const targets = dialogues.filter(predicate)
  const uneditable = difference(dialogues, targets).map(d => d.id)
  return [uneditable, targets] as const
}

export async function sendDetail (ctx: Context, dialogue: Dialogue, meta: Meta, name?: string) {
  const groups = dialogue.groups
  const output = [
    `编号为 ${dialogue.id} 的问答信息：`,
    `问题：${dialogue.original}`,
    `回答：${dialogue.answer}`,
  ]

  if (dialogue.writer) {
    output.push(name ? `来源：${name} (${dialogue.writer})` : `来源：${dialogue.writer}`)
  }

  output.push(`生效环境：${dialogue.flag & DialogueFlag.reversed
    ? groups.includes('' + meta.groupId)
      ? groups.length - 1 ? `除本群等 ${groups.length} 个群外的所有群` : '除本群'
      : groups.length ? `除 ${groups.length} 个群外的所有群` : '全局'
    : groups.includes('' + meta.groupId)
      ? groups.length - 1 ? `本群等 ${groups.length} 个群` : '本群'
      : groups.length ? `${groups.length} 个群` : '全局禁止'}`)

  if (dialogue.probability < 1) output.push(`触发权重：${dialogue.probability}`)
  ctx.emit('dialogue/detail', dialogue, output)
  if (dialogue.successors.length) output.push(`后继问题：${dialogue.successors.join(', ')}`)
  if (dialogue.flag & DialogueFlag.frozen) output.push('此问题已锁定。')

  await meta.$send(output.join('\n'))
}
