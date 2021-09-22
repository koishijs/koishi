import { Context } from 'koishi'

const dayInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const haabMonthNames = [
  'Pop', "Wo'", 'Sip', "Sotz'", 'Sek', 'Xul', "Yaxk'in",
  'Mol', "Ch'en", 'Yax', "Sak'", 'Keh', 'Mak',
  "K'ank'in", 'Muwan', 'Pax', "K'ayab", "Kumk'u", 'Wayeb',
]

const longCountUnits = [
  'Kin', 'Uinal', 'Tun', "Ka'tun", "Bak'tun",
  'Pictun', 'Kalabtun', "K'inchiltun", 'Alautun',
]

const dayNames = [
  'Ajaw', 'Imix', "Ik'", "Ak'bal", "K'an", 'Chikchan',
  'Kimi', "Manik'", 'Lamat', 'Muluk', 'Ok', 'Chuwen', 'Eb',
  'Ben', 'Ix', 'Men', "K'ib", 'Kaban', "Etz'nab", 'Kawak',
]

function isLeap(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

class MayaDate {
  constructor(public stamp: number) {}

  compare(date: MayaDate) {
    if (this.stamp > date.stamp) {
      return 1
    } else if (this.stamp < date.stamp) {
      return -1
    }
    return 0
  }

  getDelta(date: MayaDate) {
    return this.stamp - date.stamp
  }

  static fromGreg(year: number, month: number, day: number) {
    let delta = 0

    const pyear = -3113, pmonth = 8, pday = 11
    if (year < 0) {
      year += 1
    }

    let yearDelta = year - pyear - 1
    if (yearDelta < 0) {
      yearDelta = 0
    }

    let m4 = 0
    const m4begin = pyear - pyear % 4
    const m4end = year - 1 - (year > 0 ? (year - 1) % 4 : 4 + (year - 1) % 4)
    if (m4begin <= m4end) {
      m4 = Math.floor((m4end - m4begin) / 4) + 1
    }

    let m100 = 0
    const m100begin = pyear - pyear % 100
    const m100end = year - 1 - (year > 0 ? (year - 1) % 100 : 100 + (year - 1) % 100)
    if (m100begin <= m100end) {
      m100 = Math.floor((m100end - m100begin) / 100) + 1
    }

    let m400 = 0
    const m400begin = pyear - pyear % 400
    const m400end = year - 1 - (year > 0 ? (year - 1) % 400 : 400 + (year - 1) % 400)
    if (m400begin <= m400end) {
      m400 = Math.floor((m400end - m400begin) / 400) + 1
    }

    delta += yearDelta * 365 + m4 - m100 + m400

    if (pyear < year) {
      for (let m = pmonth + 1; m <= 12; m++) {
        delta += dayInMonth[m]
      }
      delta += dayInMonth[pmonth] - pday
      for (let m = 1; m < month; m++) {
        delta += dayInMonth[m]
      }
      delta += day
    } else if (pyear === year) {
      for (let m = pmonth + 1; m < month; m++) {
        delta += dayInMonth[m]
      }
      if (pmonth < month) {
        delta += dayInMonth[pmonth] - pday
        delta += day
      } else if (pmonth === month) {
        delta += day - pday
      }
    }

    if (isLeap(year) && month > 2 && pyear < year) {
      delta++
    }

    return new MayaDate(delta)
  }

  static fromMaya(mlc: string) {
    let num = 0
    const periods = mlc.split('.')
    periods.forEach((n, i) => {
      if (i === periods.length - 2) {
        num *= 18
      } else {
        num *= 20
      }
      num += (+n)
    })
    return new MayaDate(num)
  }

  toGreg() {
    let days = this.stamp
    let year = -3113, month = 8, day = 11

    const t400num = Math.floor(days / 146097)
    year += t400num * 400
    days %= 146097

    if (days > 0) {
      let has400 = false
      const next400 = MayaDate.fromGreg(year + (year > 0 ? 400 - year % 400 : -(year % 400)), 2, 29)

      const t100num = Math.floor(days / 36524)
      year += t100num * 100
      days %= 36524

      const last100 = MayaDate.fromGreg(year, month, day)
      if (last100.compare(next400) > 0) {
        has400 = true
        day--
      }

      if (days > 0) {
        let nyear = year + (year > 0 ? 100 - year % 100 : -(year % 100))
        if (nyear % 400 === 0) {
          nyear += 100
        }
        const next100 = MayaDate.fromGreg(nyear, 2, 28)

        const t4num = Math.floor(days / 1461)
        year += t4num * 4
        days %= 1461

        const last4 = MayaDate.fromGreg(year, month, day)
        if (last4.compare(next100) > 0) {
          day++
        }
        if (!has400 && last4.compare(next400) > 0) {
          day--
        }

        while (days > 0) {
          const nextYearDays = isLeap(year + 1) ? 366 : 365
          if (days >= nextYearDays) {
            year++
            days -= nextYearDays
          } else {
            let currentMonthDays = dayInMonth[month]
            if (isLeap(year) && month === 2) {
              currentMonthDays++
            }
            if (days >= currentMonthDays) {
              month++
              days -= currentMonthDays
              if (month > 12) {
                year++
                month -= 12
              }
            } else {
              day += days
              days = 0
              if (day > currentMonthDays) {
                month++
                day -= currentMonthDays
              }
              if (month > 12) {
                year++
                month -= 12
              }
            }
          }
        }
      }
    }

    return monthNames[month] + ' ' + day + ', ' + (year <= 0 ? Math.abs(year - 1) + 'BC' : year)
  }

  toMLC() {
    let days = this.stamp
    const periods: number[] = []
    periods.push(days % 20)
    days = Math.floor(days / 20)
    if (days > 0) {
      periods.push(days % 18)
      days = Math.floor(days / 18)
    }
    while (days > 0) {
      periods.push(days % 20)
      days = Math.floor(days / 20)
    }
    while (periods.length < 5) {
      periods.push(0)
    }

    return periods.map((value, index) => `${value} ${longCountUnits[index]}`).reverse().join(', ')
  }

  toTzolkin() {
    const days = this.stamp
    const daynum = (days + 4) % 13
    const dayname = dayNames[days % 20]
    return daynum + ' ' + dayname
  }

  toHaab() {
    let ht = this.stamp % 365
    let hmonth: number, hday: number
    if (ht < 12) {
      hmonth = 17
      hday = ht + 8
    } else if (ht < 17) {
      hmonth = 18
      hday = ht - 12
    } else {
      ht -= 17
      hmonth = Math.floor(ht / 20)
      hday = ht % 20
    }
    return hday + ' ' + haabMonthNames[hmonth]
  }
}

export const name = 'maya'

export function apply(ctx: Context) {
  ctx.command('tools/maya <YYYY-MM-DD> [BC|AD]', '玛雅日历换算')
    .example('maya 2012-12-21')
    .action((_, date, hint) => {
      if (!date) return '请输入正确的日期。'
      const match = date.match(/^(\d+)[-\.](\d+)[-\.](\d+)\.?$/)
      if (!match) return '请输入正确的日期。'
      const year = parseInt(match[1]) * (hint === 'BC' ? -1 : 1)
      const month = parseInt(match[2])
      const day = parseInt(match[3])
      const maya = MayaDate.fromGreg(year, month, day)
      return [
        "Tzolk'in: " + maya.toTzolkin(),
        'Haab: ' + maya.toHaab(),
        'Long Count: ' + maya.toMLC(),
      ].join('\n')
    })
}
