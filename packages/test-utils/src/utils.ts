import { SenderInfo, PostType, MetaTypeMap, SubTypeMap, Meta } from 'koishi-core'
import { camelCase } from 'koishi-utils'
import debug from 'debug'

export const BASE_SELF_ID = 514
export const showTestLog = debug('koishi:test')

/**
 * polyfill for node < 12.0
 */
export function fromEntries <T> (entries: Iterable<readonly [string, T]>) {
  const result: Record<string, T> = {}
  for (const [key, value] of entries) {
    result[key] = value
  }
  return result
}

export function createMeta <T extends PostType> (postType: T, type: MetaTypeMap[T], subType: SubTypeMap[T], meta: Meta<T> = {}) {
  if (!meta.selfId) meta.selfId = BASE_SELF_ID
  meta.postType = postType
  meta[camelCase(postType) + 'Type'] = type
  meta.subType = subType
  return meta
}

export function createArray <T> (length: number, create: (index: number) => T) {
  return Array(length).fill(undefined).map((_, index) => create(index))
}

export function sum (nums: number[]) {
  return nums.reduce((a, b) => a + b, 0)
}

export function createSender (userId: number, nickname: string, card = '') {
  return { userId, nickname, card, sex: 'unknown', age: 20 } as SenderInfo
}
