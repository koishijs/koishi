import { utils } from 'koishi-test-utils'
import { getTargetId, getUsage, updateUsage, createUser } from 'koishi-core'

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

const user = createUser(123, 1)
const realDateNow = Date.now
const timestamp = 123456789
const mockedDateNow = Date.now = jest.fn().mockReturnValue(timestamp)

describe('getUsage', () => {
  test('empty usage', () => {
    utils.getDateNumber.mockReturnValue(10000)
    const usage = getUsage('foo', user)
    expect(usage.count).toBe(0)
    expect(usage.last).toBeUndefined()
  })

  test('update usage', () => {
    expect(updateUsage('foo', user)).toBeFalsy()
    const usage = getUsage('foo', user)
    expect(usage.count).toBe(1)
    expect(usage.last).toBe(timestamp)
  })

  test('another day', () => {
    utils.getDateNumber.mockReturnValue(10001)
    const usage = getUsage('foo', user)
    expect(usage.count).toBe(0)
    expect(usage.last).toBe(timestamp)
  })

  test('10 days later', () => {
    utils.getDateNumber.mockReturnValue(10010)
    mockedDateNow.mockReturnValue(864000000 + timestamp)
    const usage = getUsage('foo', user)
    expect(usage.count).toBe(0)
    expect(usage.last).toBeUndefined()
  })
})
