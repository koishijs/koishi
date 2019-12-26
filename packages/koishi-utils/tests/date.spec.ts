import { fromDateNumber, getDateNumber } from '../src'

describe('Date Manipulations', () => {
  test('getDateNumber', () => {
    expect(getDateNumber(new Date(2020, 0))).toBe(18262)
  })

  test('fromDateNumber', () => {
    expect(+fromDateNumber(18262)).toBe(+new Date(2020, 0))
  })
})
