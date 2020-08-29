import { Time } from 'koishi-utils'
import { expect } from 'chai'
import { set, reset } from 'mockdate'
import 'koishi-test-utils/chai'

const timestamp = Date.UTC(2020, 3, 1, 1, 30)
const date = new Date(timestamp)

describe('Time Manipulations', () => {
  before(() => set(timestamp))
  after(() => reset())

  it('timezone offset', () => {
    Time.setTimezoneOffset(-480)
    expect(Time.getTimezoneOffset()).to.equal(-480)
  })

  it('date number', () => {
    Time.getDateNumber() /* make coverage happy */
    expect(Time.getDateNumber(new Date(Date.UTC(2020, 0)))).to.equal(18262)
    expect(Time.getDateNumber(1577808000000)).to.equal(18262)
    expect(+Time.fromDateNumber(18262)).to.equal(+new Date(Date.UTC(2019, 11, 31, 16)))
  })

  it('parse time', () => {
    expect(Time.parseTime('')).to.equal(0)
    expect(Time.parseTime('0.5s')).to.equal(Time.second / 2)
    expect(Time.parseTime('0.5m')).to.equal(Time.minute / 2)
    expect(Time.parseTime('0.5h')).to.equal(Time.hour / 2)
    expect(Time.parseTime('0.5d')).to.equal(Time.day / 2)
    expect(Time.parseTime('0.5w')).to.equal(Time.week / 2)
  })

  it('parse date', () => {
    expect(+Time.parseDate('')).to.equal(timestamp)
    expect(+Time.parseDate('1min')).to.equal(timestamp + Time.minute)
    expect(+Time.parseDate('2:30')).to.approximately(timestamp, Time.day)
    expect(+Time.parseDate('5-1-1:30')).to.approximately(timestamp + 30 * Time.day, Time.day)
  })

  it('format time short', () => {
    expect(Time.formatTimeShort(Time.millisecond)).to.equal('1ms')
    expect(Time.formatTimeShort(Time.second)).to.equal('1s')
    expect(Time.formatTimeShort(Time.minute)).to.equal('1m')
    expect(Time.formatTimeShort(Time.hour)).to.equal('1h')
    expect(Time.formatTimeShort(Time.day)).to.equal('1d')
  })

  it('format time long', () => {
    expect(Time.formatTime(Time.millisecond)).to.equal('0 秒')
    expect(Time.formatTime(Time.second)).to.equal('1 秒')
    expect(Time.formatTime(Time.minute)).to.equal('1 分钟')
    expect(Time.formatTime(Time.minute + 40 * Time.second)).to.equal('1 分钟 40 秒')
    expect(Time.formatTime(Time.hour)).to.equal('1 小时')
    expect(Time.formatTime(Time.hour + 50 * Time.minute)).to.equal('1 小时 50 分钟')
    expect(Time.formatTime(Time.day)).to.equal('1 天')
    expect(Time.formatTime(Time.day + 20 * Time.hour)).to.equal('1 天 20 小时')
  })

  it('format time interval', () => {
    expect(Time.formatTimeInterval(date)).to.equal(date.toLocaleString())
    expect(Time.formatTimeInterval(date, Time.day)).to.equal('每天 ' + date.toLocaleTimeString())
    Time.formatTimeInterval(date, Time.week) // make coverage happy
    Time.formatTimeInterval(date, Time.hour) // make coverage happy
  })
})
