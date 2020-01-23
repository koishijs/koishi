import * as utils from 'koishi-utils'

const _utils = jest.requireActual('koishi-utils') as typeof utils

type RealRandomPick = typeof utils.randomPick
interface MockedRandomPick extends RealRandomPick, jest.Mock<any, [readonly any[]]> {
  mockIndex (index: number): this
  mockIndexOnce (index: number): this
}

type RealRandomSplice = typeof utils.randomSplice
interface MockedRandomSplice extends RealRandomSplice, jest.Mock<any, [any[]]> {
  mockIndex (index: number): this
  mockIndexOnce (index: number): this
}

type RealRandomMultiPick = typeof utils.randomMultiPick
interface MockedRandomMultiPick extends RealRandomMultiPick, jest.Mock<any, [readonly any[], number]> {
  mockIndices (...indices: number[]): this
  mockIndicesOnce (...indices: number[]): this
}

export const randomBool = jest.fn(_utils.randomBool)
export const randomId = jest.fn(_utils.randomId)
export const randomReal = jest.fn(_utils.randomReal)
export const randomInt = jest.fn(_utils.randomInt)
export const randomPick: MockedRandomPick = jest.fn(_utils.randomPick) as any
export const randomSplice: MockedRandomSplice = jest.fn(_utils.randomSplice) as any
export const randomMultiPick: MockedRandomMultiPick = jest.fn(_utils.randomMultiPick) as any
export const randomWeightedPick = jest.fn(_utils.randomWeightedPick)

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
