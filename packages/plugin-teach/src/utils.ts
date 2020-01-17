import { Context, Meta } from 'koishi-core'
import { simplify, contain, intersection, union, difference } from 'koishi-utils'

export interface TeachConfig {
  useWriter?: boolean
  useFrozen?: boolean
  useEnvironment?: boolean
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

export interface Dialogue {
  id?: number
  question: string
  answer: string
  writer: number
  groups: number[]
  flag: number
  probability: number
}

export interface DialogueTest {
  groups?: number[]
  question?: string
  answer?: string
  writer?: number
  regexp?: boolean
  keyword?: boolean
  strict?: boolean
  frozen?: boolean
  reversed?: boolean
  partial?: boolean
}

export interface ParsedTeachLine {
  ctx: Context
  meta: Meta
  args: string[]
  argc: number
  options: Record<string, any>
  config: TeachConfig
  writer?: number
  groups?: number[]
  partial?: boolean
  reversed?: boolean
}

export enum DialogueFlag {
  frozen = 1,
  regexp = 2,
  keyword = 4,
  appellation = 8,
  reversed = 16,
}

export namespace DialogueEnv {
  export function split (source: string) {
    return source ? source.split(',').map(i => parseInt(i)) : []
  }

  export function join (source: number[], separator = ',') {
    return source.sort((a, b) => a - b).join(separator)
  }

  export function test (data: Dialogue, test: DialogueTest) {
    if (!test.groups) return true
    const sameFlag = !(data.flag & DialogueFlag.reversed) !== test.reversed
    if (test.partial) {
      return sameFlag ? contain(data.groups, test.groups) : !intersection(data.groups, test.groups).length
    } else {
      return sameFlag && join(test.groups) === join(data.groups)
    }
  }

  export function modify (data: Dialogue, config: ParsedTeachLine) {
    const sameFlag = !(data.flag & DialogueFlag.reversed) !== config.reversed
    if (config.partial) {
      data.groups = sameFlag ? union(data.groups, config.groups) : difference(data.groups, config.groups)
    } else {
      data.flag &= ~DialogueFlag.reversed
      data.flag |= +config.reversed * DialogueFlag.reversed
      data.groups = config.groups.slice()
    }
  }
}
