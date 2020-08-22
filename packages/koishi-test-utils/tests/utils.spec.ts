import { utils } from '../src'
import * as _utils from 'koishi-utils'
import { expect } from 'chai'

describe('mocked random API', () => {
  it('randomPick', () => {
    utils.Random.pick.mockIndex(1)
    utils.Random.pick.mockIndexOnce(0)
    const source = ['a', 'b', 'c']
    expect(_utils.Random.pick(source)).to.equal('a')
    expect(_utils.Random.pick(source)).to.equal('b')
  })

  it('randomMultiPick', () => {
    utils.Random.multiPick.mockIndex(0)
    utils.Random.multiPick.mockIndexOnce(1, 2)
    const source = ['a', 'b', 'c']
    expect(_utils.Random.multiPick(source, 2)).to.deep.equal(['b', 'c'])
    expect(_utils.Random.multiPick(source, 1)).to.deep.equal(['a'])
  })
})
