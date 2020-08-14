import { utils } from '../src'
import * as _utils from 'koishi-utils'
import { expect } from 'chai'

test('randomPick', () => {
  utils.randomPick.mockIndex(1)
  utils.randomPick.mockIndexOnce(0)
  const source = ['a', 'b', 'c']
  expect(_utils.randomPick(source)).toEqual('a')
  expect(_utils.randomPick(source)).toEqual('b')
})

test('randomSplice', () => {
  utils.randomSplice.mockIndex(1)
  utils.randomSplice.mockIndexOnce(0)
  const source = ['a', 'b', 'c']
  expect(_utils.randomSplice(source)).toEqual('a')
  expect(_utils.randomSplice(source)).toEqual('c')
})

test('randomMultiPick', () => {
  utils.randomMultiPick.mockIndices(0)
  utils.randomMultiPick.mockIndicesOnce(1, 2)
  const source = ['a', 'b', 'c']
  expect(_utils.randomMultiPick(source, 2)).toEqual(['b', 'c'])
  expect(_utils.randomMultiPick(source, 1)).toEqual(['a'])
})
