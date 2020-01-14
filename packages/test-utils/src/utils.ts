import { SenderInfo } from 'koishi-core'
import debug from 'debug'

export const BASE_SELF_ID = 514
export const showTestLog = debug('koishi:test')

export type RequestData = readonly [string, Record<string, any>]

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

export function createArray <T> (length: number, create: (index: number) => T) {
  return Array(length).fill(undefined).map((_, index) => create(index))
}

export function createSender (userId: number, nickname: string, card = '') {
  return { userId, nickname, card, sex: 'unknown', age: 20 } as SenderInfo
}
