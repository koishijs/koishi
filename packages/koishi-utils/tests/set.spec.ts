import { union, intersection, difference, contain } from '../src'

describe('set operations', () => {
  test('union', () => {
    expect(union([1, 2], [3, 4])).toMatchObject([1, 2, 3, 4])
    expect(union([1, 2], [1, 3])).toMatchObject([1, 2, 3])
    expect(union([], [2, 3])).toMatchObject([2, 3])
  })

  test('intersection', () => {
    expect(intersection([1, 2], [3, 4])).toMatchObject([])
    expect(intersection([1, 2], [1, 3])).toMatchObject([1])
    expect(intersection([1, 2, 3], [2, 3])).toMatchObject([2, 3])
  })

  test('difference', () => {
    expect(difference([1, 2], [3, 4])).toMatchObject([1, 2])
    expect(difference([1, 2], [1, 3])).toMatchObject([2])
    expect(difference([2, 3], [])).toMatchObject([2, 3])
    expect(difference([], [2, 3])).toMatchObject([])
  })

  test('contain', () => {
    expect(contain([1, 2], [3, 4])).toBe(false)
    expect(contain([1, 2], [1, 3])).toBe(false)
    expect(contain([2, 3], [])).toBe(true)
    expect(contain([], [2, 3])).toBe(false)
  })
})
