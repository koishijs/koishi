export namespace Time {
  export const millisecond = 1
  export const second = 1000
  export const minute = second * 60
  export const hour = minute * 60
  export const day = hour * 24
  export const week = day * 7

  let timezoneOffset = new Date().getTimezoneOffset()

  export function setTimezoneOffset(offset: number) {
    timezoneOffset = offset
  }

  export function getTimezoneOffset() {
    return timezoneOffset
  }

  export function getDateNumber(date: number | Date = new Date(), offset?: number) {
    if (typeof date === 'number') date = new Date(date)
    if (offset === undefined) offset = timezoneOffset
    return Math.floor((date.valueOf() / minute - offset) / 1440)
  }

  export function fromDateNumber(value: number, offset?: number) {
    const date = new Date(value * day)
    if (offset === undefined) offset = timezoneOffset
    return new Date(+date + offset * minute)
  }

  const timeRegExp = /^(\d+(?:\.\d+)?w(?:eek(?:s)?)?)?(\d+(?:\.\d+)?d(?:ay(?:s)?)?)?(\d+(?:\.\d+)?h(?:our(?:s)?)?)?(\d+(?:\.\d+)?m(?:in(?:ute)?(?:s)?)?)?(\d+(?:\.\d+)?s(?:ec(?:ond)?(?:s)?)?)?$/

  export function parseTime(source: string) {
    const capture = timeRegExp.exec(source)
    if (!capture) return 0
    return (parseFloat(capture[1]) * week || 0)
      + (parseFloat(capture[2]) * day || 0)
      + (parseFloat(capture[3]) * hour || 0)
      + (parseFloat(capture[4]) * minute || 0)
      + (parseFloat(capture[5]) * second || 0)
  }

  export function parseDate(date: string) {
    const parsed = parseTime(date)
    if (parsed) {
      date = Date.now() + parsed as any
    } else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) {
      date = `${new Date().toLocaleDateString()}-${date}`
    } else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) {
      date = `${new Date().getFullYear()}-${date}`
    }
    return date ? new Date(date) : new Date()
  }

  export function formatTimeShort(ms: number) {
    const abs = Math.abs(ms)
    if (abs >= day - hour / 2) {
      return Math.round(ms / day) + 'd'
    } else if (abs >= hour - minute / 2) {
      return Math.round(ms / hour) + 'h'
    } else if (abs >= minute - second / 2) {
      return Math.round(ms / minute) + 'm'
    } else if (abs >= second) {
      return Math.round(ms / second) + 's'
    }
    return ms + 'ms'
  }

  export function formatTime(ms: number) {
    let result: string
    if (ms >= day - hour / 2) {
      ms += hour / 2
      result = Math.floor(ms / day) + ' 天'
      if (ms % day > hour) {
        result += ` ${Math.floor(ms % day / hour)} 小时`
      }
    } else if (ms >= hour - minute / 2) {
      ms += minute / 2
      result = Math.floor(ms / hour) + ' 小时'
      if (ms % hour > minute) {
        result += ` ${Math.floor(ms % hour / minute)} 分钟`
      }
    } else if (ms >= minute - second / 2) {
      ms += second / 2
      result = Math.floor(ms / minute) + ' 分钟'
      if (ms % minute > second) {
        result += ` ${Math.floor(ms % minute / second)} 秒`
      }
    } else {
      result = Math.round(ms / second) + ' 秒'
    }
    return result
  }

  const dayMap = ['日', '一', '二', '三', '四', '五', '六']

  export function formatTimeInterval(time: Date, interval?: number) {
    if (!interval) {
      return time.toLocaleString()
    } else if (interval === day) {
      return `每天 ${time.toLocaleTimeString()}`
    } else if (interval === week) {
      return `每周${dayMap[time.getDay()]} ${time.toLocaleTimeString()}`
    } else {
      return `${time.toLocaleString()} 起每隔 ${formatTime(interval)}`
    }
  }
}
