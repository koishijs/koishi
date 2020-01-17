import { getTargetId } from 'koishi-core'

describe('getTargetId', () => {
  test('with id', () => {
    expect(getTargetId('12345')).toBe(12345)
  })

  test('with at', () => {
    expect(getTargetId('[CQ:at,qq=12345]')).toBe(12345)
  })

  test('wrong syntax', () => {
    expect(getTargetId('')).toBeFalsy()
    expect(getTargetId(true as any)).toBeFalsy()
    expect(getTargetId('[CQ:at,qq=]')).toBeFalsy()
    expect(getTargetId('foo123')).toBeFalsy()
  })
})
