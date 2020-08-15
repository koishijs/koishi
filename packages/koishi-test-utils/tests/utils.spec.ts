import { utils } from '../src'
import * as _utils from 'koishi-utils'
import { expect } from 'chai'

describe('mocked random API', () => {
  it('randomPick', () => {
    utils.randomPick.mockIndex(1)
    utils.randomPick.mockIndexOnce(0)
    const source = ['a', 'b', 'c']
    expect(_utils.randomPick(source)).to.equal('a')
    expect(_utils.randomPick(source)).to.equal('b')
  })
  
  it('randomSplice', () => {
    utils.randomSplice.mockIndex(1)
    utils.randomSplice.mockIndexOnce(0)
    const source = ['a', 'b', 'c']
    expect(_utils.randomSplice(source)).to.equal('a')
    expect(_utils.randomSplice(source)).to.equal('c')
  })
  
  it('randomMultiPick', () => {
    utils.randomMultiPick.mockIndices(0)
    utils.randomMultiPick.mockIndicesOnce(1, 2)
    const source = ['a', 'b', 'c']
    expect(_utils.randomMultiPick(source, 2)).to.deep.equal(['b', 'c'])
    expect(_utils.randomMultiPick(source, 1)).to.deep.equal(['a'])
  })
})
