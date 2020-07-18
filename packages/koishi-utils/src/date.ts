let timezoneOffset = new Date().getTimezoneOffset()

export function setTimezoneOffset (offset: number) {
  timezoneOffset = offset
}

export function getTimezoneOffset () {
  return timezoneOffset
}

export namespace Time {
  export const second = 1000
  export const minute = second * 60
  export const hour = minute * 60
  export const day = hour * 24
  export const week = day * 7
}

export function getDateNumber (date: number | Date = new Date(), offset?: number) {
  if (typeof date === 'number') date = new Date(date)
  if (offset === undefined) offset = timezoneOffset
  return Math.floor((date.valueOf() / Time.minute - offset) / 1440)
}

export function fromDateNumber (value: number, offset?: number) {
  const date = new Date(value * Time.day)
  if (offset === undefined) offset = timezoneOffset
  return new Date(+date + offset * Time.minute)
}

const timeRegExp = /^(\d+(?:\.\d+)?w(?:eek(?:s)?)?)?(\d+(?:\.\d+)?d(?:ay(?:s)?)?)?(\d+(?:\.\d+)?h(?:our(?:s)?)?)?(\d+(?:\.\d+)?m(?:in(?:ute)?(?:s)?)?)?(\d+(?:\.\d+)?s(?:ec(?:ond)?(?:s)?)?)?$/

export function parseTime (source: string) {
  const capture = timeRegExp.exec(source)
  if (!capture) return 0
  return (parseFloat(capture[1]) * Time.week || 0)
    + (parseFloat(capture[2]) * Time.day || 0)
    + (parseFloat(capture[3]) * Time.hour || 0)
    + (parseFloat(capture[4]) * Time.minute || 0)
    + (parseFloat(capture[5]) * Time.second || 0)
}

export function parseDate (date: string) {
  let parsed: number
  if (parsed = parseTime(date)) {
    date = Date.now() + parsed as any
  } else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) {
    date = `${new Date().toLocaleDateString()}-${date}`
  } else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) {
    date = `${new Date().getFullYear()}-${date}`
  }
  return date ? new Date(date) : new Date()
}

export function formatTime (ms: number) {
  let result: string
  if (ms >= Time.day - Time.hour / 2) {
    ms += Time.hour / 2
    result = Math.floor(ms / Time.day) + ' 天'
    if (ms % Time.day > Time.hour) {
      result += ` ${Math.floor(ms % Time.day / Time.hour)} 小时`
    }
  } else if (ms >= Time.hour - Time.minute / 2) {
    ms += Time.minute / 2
    result = Math.floor(ms / Time.hour) + ' 小时'
    if (ms % Time.hour > Time.minute) {
      result += ` ${Math.floor(ms % Time.hour / Time.minute)} 分钟`
    }
  } else if (ms >= Time.minute - Time.second / 2) {
    ms += Time.second / 2
    result = Math.floor(ms / Time.minute) + ' 分钟'
    if (ms % Time.minute > Time.second) {
      result += ` ${Math.floor(ms % Time.minute / Time.second)} 秒`
    }
  } else {
    result = Math.round(ms / Time.second) + ' 秒'
  }
  return result
}

const dayMap = ['日', '一', '二', '三', '四', '五', '六']

export function formatTimeInterval (time: Date, interval: number) {
  if (!interval) {
    return time.toLocaleString()
  } else if (interval === Time.day) {
    return `每天 ${time.toLocaleTimeString()}`
  } else if (interval === Time.week) {
    return `每周${dayMap[time.getDay()]} ${time.toLocaleTimeString()}`
  } else {
    return `${time.toLocaleString()} 起每隔 ${formatTime(interval)}`
  }
}
