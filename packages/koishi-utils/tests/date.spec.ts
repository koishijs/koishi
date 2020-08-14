import { fromDateNumber, getDateNumber, setTimezoneOffset, getTimezoneOffset, parseTime, Time, parseDate } from '../src'
import { expect } from 'chai'

describe('Date Manipulations', () => {
  it('date number', () => {
    getDateNumber() /* make coverage happy */
    expect(getDateNumber(new Date(2020, 0))).to.equal(18262)
    expect(getDateNumber(1577808000000)).to.equal(18262)

    expect(+fromDateNumber(18262)).to.equal(+new Date(2020, 0))
  })

  it('timezone offset', () => {
    setTimezoneOffset(60)
    expect(getTimezoneOffset()).to.equal(60)
  })

  it('parse time', () => {
    expect(parseTime('')).to.equal(0)
    expect(parseTime('0.5s')).to.equal(Time.second / 2)
    expect(parseTime('0.5m')).to.equal(Time.minute / 2)
    expect(parseTime('0.5h')).to.equal(Time.hour / 2)
    expect(parseTime('0.5d')).to.equal(Time.day / 2)
    expect(parseTime('0.5w')).to.equal(Time.week / 2)
  })
})
