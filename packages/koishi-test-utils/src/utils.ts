import { Logger } from 'koishi-utils'

export const BASE_SELF_ID = 514
export const showTestLog = Logger.create('test').debug

export function createArray <T> (length: number, create: (index: number) => T) {
  return Array(length).fill(undefined).map((_, index) => create(index))
}
