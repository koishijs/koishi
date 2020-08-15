import * as utils from 'koishi-utils'
import { Mock, fn } from 'jest-mock'
import { actualModule } from './module'

const _utils = actualModule('koishi-utils') as typeof utils

type RealRandomPick = typeof utils.randomPick
interface MockedRandomPick extends RealRandomPick, Mock<any, [readonly any[]]> {
  mockIndex(index: number): this
  mockIndexOnce(index: number): this
}

type RealRandomSplice = typeof utils.randomSplice
interface MockedRandomSplice extends RealRandomSplice, Mock<any, [any[]]> {
  mockIndex(index: number): this
  mockIndexOnce(index: number): this
}

type RealRandomMultiPick = typeof utils.randomMultiPick
interface MockedRandomMultiPick extends RealRandomMultiPick, Mock<any, [readonly any[], number]> {
  mockIndices(...indices: number[]): this
  mockIndicesOnce(...indices: number[]): this
}

type RealTime = typeof _utils.Time
interface MockedTime extends RealTime {
  getDateNumber: Mock<number, [(number | Date)?, number?]>
  fromDateNumber: Mock<Date, [number, number?]>
}

export const sleep = fn(_utils.sleep)
export const randomBool = fn(_utils.randomBool)
export const randomId = fn(_utils.randomId)
export const randomReal = fn(_utils.randomReal)
export const randomInt = fn(_utils.randomInt)
export const randomPick: MockedRandomPick = fn(_utils.randomPick) as any
export const randomSplice: MockedRandomSplice = fn(_utils.randomSplice) as any
export const randomMultiPick: MockedRandomMultiPick = fn(_utils.randomMultiPick) as any
export const randomWeightedPick = fn(_utils.randomWeightedPick)

export const Time = {
  ..._utils.Time,
  getDateNumber: fn(_utils.Time.getDateNumber),
  fromDateNumber: fn(_utils.Time.fromDateNumber),
} as MockedTime

randomPick.mockIndex = (index) => {
  return randomPick.mockImplementation(source => source[index])
}

randomPick.mockIndexOnce = (index) => {
  return randomPick.mockImplementationOnce(source => source[index])
}

randomSplice.mockIndex = (index) => {
  return randomSplice.mockImplementation(source => source.splice(index, 1)[0])
}

randomSplice.mockIndexOnce = (index) => {
  return randomSplice.mockImplementationOnce(source => source.splice(index, 1)[0])
}

randomMultiPick.mockIndices = (...indices) => {
  return randomMultiPick.mockImplementation((source) => {
    return indices.map(index => source[index])
  })
}

randomMultiPick.mockIndicesOnce = (...indices) => {
  return randomMultiPick.mockImplementationOnce((source) => {
    return indices.map(index => source[index])
  })
}
