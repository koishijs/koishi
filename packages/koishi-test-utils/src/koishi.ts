import * as utils from 'koishi-utils'
import { Mock, fn } from 'jest-mock'
import { actualModule } from './module'

type Mocked<O> = { [P in keyof O]: Mocked<O[P]> }
  & (O extends (...args: infer R) => infer T ? Mock<T, R> : unknown)

const _utils = actualModule('koishi-utils') as typeof utils

interface MockedRandomPick extends Mocked<typeof utils.Random.pick> {
  mockIndex(index: number): this
  mockIndexOnce(index: number): this
}

interface MockedRandomMultiPick extends Mocked<typeof utils.Random.multiPick> {
  mockIndex(...indices: number[]): this
  mockIndexOnce(...indices: number[]): this
}

interface MockedRandom extends Mocked<typeof utils.Random> {
  pick: MockedRandomPick
  multiPick: MockedRandomMultiPick
}

interface MockedTime extends Mocked<typeof utils.Time> {
  getDateNumber: Mock<number, [(number | Date)?, number?]>
  fromDateNumber: Mock<Date, [number, number?]>
}

export const Random = {
  uuid: fn(_utils.Random.uuid),
  bool: fn(_utils.Random.bool),
  int: fn(_utils.Random.int),
  real: fn(_utils.Random.real),
  pick: fn(_utils.Random.pick),
  shuffle: fn(_utils.Random.shuffle),
  multiPick: fn(_utils.Random.multiPick),
  weightedPick: fn(_utils.Random.weightedPick),
} as MockedRandom

export const Time = {
  ..._utils.Time,
  getDateNumber: fn(_utils.Time.getDateNumber),
  fromDateNumber: fn(_utils.Time.fromDateNumber),
} as MockedTime

Random.pick.mockIndex = (index) => {
  return Random.pick.mockImplementation(source => source[index])
}

Random.pick.mockIndexOnce = (index) => {
  return Random.pick.mockImplementationOnce(source => source[index])
}

Random.multiPick.mockIndex = (...indices) => {
  return Random.multiPick.mockImplementation((source) => {
    return indices.map(index => source[index])
  })
}

Random.multiPick.mockIndexOnce = (...indices) => {
  return Random.multiPick.mockImplementationOnce((source) => {
    return indices.map(index => source[index])
  })
}
