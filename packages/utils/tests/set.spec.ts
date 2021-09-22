import { union, intersection, difference, contain, deduplicate } from 'koishi'
import { expect } from 'chai'

describe('Set Manipulations', () => {
  it('union', () => {
    expect(union([1, 2], [3, 4])).to.deep.equal([1, 2, 3, 4])
    expect(union([1, 2], [1, 3])).to.deep.equal([1, 2, 3])
    expect(union([], [2, 3])).to.deep.equal([2, 3])
  })

  it('intersection', () => {
    expect(intersection([1, 2], [3, 4])).to.deep.equal([])
    expect(intersection([1, 2], [1, 3])).to.deep.equal([1])
    expect(intersection([1, 2, 3], [2, 3])).to.deep.equal([2, 3])
  })

  it('difference', () => {
    expect(difference([1, 2], [3, 4])).to.deep.equal([1, 2])
    expect(difference([1, 2], [1, 3])).to.deep.equal([2])
    expect(difference([2, 3], [])).to.deep.equal([2, 3])
    expect(difference([], [2, 3])).to.deep.equal([])
  })

  it('contain', () => {
    expect(contain([1, 2], [3, 4])).to.equal(false)
    expect(contain([1, 2], [1, 3])).to.equal(false)
    expect(contain([2, 3], [])).to.equal(true)
    expect(contain([], [2, 3])).to.equal(false)
  })

  it('deduplicate', () => {
    expect(deduplicate([1, 2, 3, 3])).to.deep.equal([1, 2, 3])
  })
})
