import { Context, Meta } from 'koishi-core'
import { simplify, contain, intersection, union, difference } from 'koishi-utils'
import { Dialogue, DialogueTest, DialogueFlag } from './database'

export interface TeachConfig {
  getUserName? (meta: Meta<'message'>): string
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

export function splitGroups (source: string) {
  return source ? source.split(',').map(i => parseInt(i)) : []
}

export function joinGroups (source: number[], separator = ',') {
  return source.sort((a, b) => a - b).join(separator)
}

export function testGroups (data: Dialogue, test: DialogueTest) {
  if (!test.groups) return true
  const sameFlag = !(data.flag & DialogueFlag.reversed) !== test.reversed
  if (test.partial) {
    return sameFlag
      ? contain(data.groups, test.groups)
      : !intersection(data.groups, test.groups).length
  } else {
    return sameFlag && joinGroups(test.groups) === joinGroups(data.groups)
  }
}

export function modifyGroups (data: Dialogue, config: ParsedTeachLine) {
  if (config.partial) {
    data.groups = !(data.flag & DialogueFlag.reversed) !== config.reversed
      ? union(data.groups, config.groups)
      : difference(data.groups, config.groups)
  } else {
    data.flag &= ~DialogueFlag.reversed
    data.flag |= +config.reversed * DialogueFlag.reversed
    data.groups = config.groups.slice()
  }
}
