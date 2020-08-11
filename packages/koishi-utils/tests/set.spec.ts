import { union, intersection, difference, contain, deduplicate } from '../src'

describe('set operations', () => {
  test('union', () => {
    expect(union([1, 2], [3, 4])).toEqual([1, 2, 3, 4])
    expect(union([1, 2], [1, 3])).toEqual([1, 2, 3])
    expect(union([], [2, 3])).toEqual([2, 3])
  })

  test('intersection', () => {
    expect(intersection([1, 2], [3, 4])).toEqual([])
    expect(intersection([1, 2], [1, 3])).toEqual([1])
    expect(intersection([1, 2, 3], [2, 3])).toEqual([2, 3])
  })

  test('difference', () => {
    expect(difference([1, 2], [3, 4])).toEqual([1, 2])
    expect(difference([1, 2], [1, 3])).toEqual([2])
    expect(difference([2, 3], [])).toEqual([2, 3])
    expect(difference([], [2, 3])).toEqual([])
  })

  test('contain', () => {
    expect(contain([1, 2], [3, 4])).toBe(false)
    expect(contain([1, 2], [1, 3])).toBe(false)
    expect(contain([2, 3], [])).toBe(true)
    expect(contain([], [2, 3])).toBe(false)
  })

  test('deduplicate', () => {
    expect(deduplicate([1, 2, 3, 3])).toEqual([1, 2, 3])
  })
})
