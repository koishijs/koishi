import { fromDateNumber, getDateNumber, setTimezoneOffset, getTimezoneOffset, parseTime, Time, parseDate } from '../src'

describe('Date Manipulations', () => {
  test('date number', () => {
    getDateNumber() /* make coverage happy */
    expect(getDateNumber(new Date(2020, 0))).toBe(18262)
    expect(getDateNumber(1577808000000)).toBe(18262)

    expect(+fromDateNumber(18262)).toBe(+new Date(2020, 0))
  })

  test('timezone offset', () => {
    setTimezoneOffset(60)
    expect(getTimezoneOffset()).toBe(60)
  })

  test('parse time', () => {
    expect(parseTime('')).toBe(0)
    expect(parseTime('.5s')).toBe(Time.second / 2)
    expect(parseTime('.5m')).toBe(Time.minute / 2)
    expect(parseTime('.5h')).toBe(Time.hour / 2)
    expect(parseTime('.5d')).toBe(Time.day / 2)
    expect(parseTime('.5w')).toBe(Time.week / 2)
  })
})
