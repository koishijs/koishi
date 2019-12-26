import { randomId, randomBool, randomReal, randomInt, randomPick, randomSplice, randomMultiPick, randomWeightedPick, isInteger } from '../src'

describe('Random Manipulations', () => {
  test('randomId', () => {
    expect(randomId(10)).toHaveLength(10)
  })

  test('randomBool', () => {
    const value = randomBool(0.5)
    expect(typeof value).toBe('boolean')
  })

  test('randomReal', () => {
    for (let i = 0; i < 10; ++i) {
      const value = randomReal(2, 5)
      expect(value < 5 && value >= 2).toBe(true)
    }
  })

  test('randomInt', () => {
    for (let i = 0; i < 10; ++i) {
      const value = randomInt(2, 5.9)
      expect(value <= 5 && value >= 2 && isInteger(value)).toBe(true)
    }
  })

  test('randomPick', () => {
    const source = new Array(10).fill(undefined).map((_, index) => index)
    const value = randomPick(source)
    expect(value < 10 && value >= 0 && isInteger(value)).toBe(true)
    expect(source).toHaveLength(10)
  })

  test('randomSplice', () => {
    const source = new Array(10).fill(undefined).map((_, index) => index)
    const value = randomSplice(source)
    expect(value < 10 && value >= 0 && isInteger(value)).toBe(true)
    expect(source).toHaveLength(9)
    expect(source.indexOf(value)).toBe(-1)
  })

  test('randomMultiPick', () => {
    const source = new Array(10).fill(undefined).map((_, index) => index)
    const values = randomMultiPick(source, 5)
    values.forEach(value => expect(value < 10 && value >= 0 && isInteger(value)).toBe(true))
    expect(values).toHaveLength(5)
    expect(source).toHaveLength(10)
  })

  test('randomWeightedPick', () => {
    const source: Record<string, number> = {}
    for (let index = 0; index < 10; ++index) source[index] = index
    const value = +randomWeightedPick(source)
    expect(value < 10 && value >= 0 && isInteger(value)).toBe(true)
    expect(Object.keys(source)).toHaveLength(10)
  })
})
