import { getSenderName, createUser, getTargetId } from 'koishi-core'
import { createSender } from 'koishi-test-utils'
import { observe } from 'koishi-utils'

describe('getSenderName', () => {
  test('userData with userId', () => {
    expect(getSenderName({
      userId: 123,
      $user: observe(createUser(123, 1)),
    })).toBe('123')
  })

  test('userData with name', () => {
    expect(getSenderName({
      userId: 123,
      $user: observe({ ...createUser(123, 1), name: '456' }),
      sender: createSender(123, 'bar', 'foo'),
    })).toBe('456')
  })

  test('userData with card', () => {
    expect(getSenderName({
      userId: 123,
      $user: observe(createUser(123, 1)),
      sender: createSender(123, 'bar', 'foo'),
    })).toBe('foo')
  })

  test('userData with nickname', () => {
    expect(getSenderName({
      userId: 123,
      $user: observe(createUser(123, 1)),
      sender: createSender(123, 'bar'),
    })).toBe('bar')
  })
})

describe('getTargetId', () => {
  test('with id', () => {
    expect(getTargetId('12345')).toBe(12345)
  })

  test('with at', () => {
    expect(getTargetId('[CQ:at,qq=12345]')).toBe(12345)
  })

  test('wrong syntax', () => {
    expect(getTargetId('')).toBeFalsy()
    expect(getTargetId('[CQ:at,qq=]')).toBeFalsy()
    expect(getTargetId('foo123')).toBeFalsy()
  })
})
