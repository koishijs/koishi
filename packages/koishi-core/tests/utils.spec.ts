import { utils } from 'koishi-test-utils'
import { getTargetId, getUsage, updateUsage, createUser } from 'koishi-core'

describe('getTargetId', () => {
  test('with id', () => {
    expect(getTargetId('12345')).to.equal(12345)
  })

  test('with at', () => {
    expect(getTargetId('[CQ:at,qq=12345]')).to.equal(12345)
  })

  test('wrong syntax', () => {
    expect(getTargetId('')).not.to.be.ok
    expect(getTargetId(true as any)).not.to.be.ok
    expect(getTargetId('[CQ:at,qq=]')).not.to.be.ok
    expect(getTargetId('foo123')).not.to.be.ok
  })
})

const user = createUser(123, 1)
const timestamp = 123456789
const mockedDateNow = Date.now = jest.fn().mockReturnValue(timestamp)

describe('getUsage', () => {
  test('empty usage', () => {
    utils.getDateNumber.mockReturnValue(10000)
    const usage = getUsage('foo', user)
    expect(usage).toEqual({})
  })

  test('update usage', () => {
    expect(updateUsage('foo', user, { maxUsage: 1, minInterval: 1000 })).not.to.be.ok
    const usage = getUsage('foo', user)
    expect(usage).toEqual({ count: 1, last: timestamp })
  })

  test('too frequent', () => {
    mockedDateNow.mockReturnValue(timestamp - 1000)
    expect(updateUsage('foo', user)).to.be.ok
    const usage = getUsage('foo', user)
    expect(usage).toEqual({ count: 1, last: timestamp })
  })

  test('update usage 2', () => {
    mockedDateNow.mockReturnValue(timestamp)
    expect(updateUsage('foo', user)).not.to.be.ok
    const usage = getUsage('foo', user)
    expect(usage).toEqual({ count: 1, last: timestamp })
  })

  test('another day', () => {
    utils.getDateNumber.mockReturnValue(10001)
    const usage = getUsage('foo', user)
    expect(usage).toEqual({ last: timestamp })
  })

  test('10 days later', () => {
    utils.getDateNumber.mockReturnValue(10010)
    mockedDateNow.mockReturnValue(864000000 + timestamp)
    const usage = getUsage('foo', user)
    expect(usage).toEqual({})
  })
})
