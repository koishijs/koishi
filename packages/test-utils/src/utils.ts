import { SenderInfo, PostType, MetaTypeMap, SubTypeMap, Meta, AppOptions, App } from 'koishi-core'
import { camelCase } from 'koishi-utils'
import debug from 'debug'

export const showTestLog = debug('koishi:test')

export function createApp (options: AppOptions = {}) {
  const app = new App({ selfId: 514, ...options })
  beforeAll(() => app.start())
  afterAll(() => app.stop())
  return app
}

export function createMeta <T extends PostType> (postType: T, type: MetaTypeMap[T], subType: SubTypeMap[T], meta: Meta<T> = {}) {
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
