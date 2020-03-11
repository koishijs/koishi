import { Context, Meta } from 'koishi-core'
import { simplify, contain, intersection, union, difference, randomId } from 'koishi-utils'
import { Dialogue, DialogueTest, DialogueFlag } from './database'

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
  options: {
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
    minAffinity?: number
    maxAffinity?: number
  }
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

export function testGroups (data: Dialogue, test: DialogueTest) {
  if (!test.groups) return true
  const sameFlag = !(data.flag & DialogueFlag.reversed) !== test.reversed
  if (test.partial) {
    return sameFlag
      ? contain(data.groups, test.groups)
      : !intersection(data.groups, test.groups).length
  } else {
    return sameFlag && idEqual(test.groups, data.groups)
  }
}

export function testDialogue (data: Dialogue, test: DialogueTest) {
  if (test.frozen !== undefined && test.frozen === !(data.flag & DialogueFlag.frozen)) return
  if (test.writer && data.writer !== test.writer) return
  if (test.successors && !contain(data.successors, test.successors)) return
  return true
}

export function modifyDialogue (data: Dialogue, argv: TeachArgv) {
  const { partial, reversed, groups, options, successors, succOverwrite } = argv

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
  if (options.minAffinity !== undefined) data.minAffinity = options.minAffinity
  if (options.maxAffinity !== undefined) data.maxAffinity = options.maxAffinity

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
