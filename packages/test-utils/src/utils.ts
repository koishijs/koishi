import { SenderInfo } from 'koishi-core'

export function createArray <T> (length: number, create: (index: number) => T) {
  return Array(length).fill(undefined).map((_, index) => create(index))
}

export function sum (nums: number[]) {
  return nums.reduce((a, b) => a + b, 0)
}

export function createSender (userId: number, nickname: string, card = '') {
  return { userId, nickname, card, sex: 'unknown', age: 20 } as SenderInfo
}
