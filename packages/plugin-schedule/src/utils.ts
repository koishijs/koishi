import { Meta } from 'koishi-core'

const second = 1000
const minute = second * 60
const hour = minute * 60
const day = hour * 24
const week = day * 7

const timeRegExp = /^(\d+(?:\.\d+)?w(?:eek(?:s)?)?)?(\d+(?:\.\d+)?d(?:ay(?:s)?)?)?(\d+(?:\.\d+)?h(?:our(?:s)?)?)?(\d+(?:\.\d+)?m(?:in(?:ute)?(?:s)?)?)?(\d+(?:\.\d+)?s(?:ec(?:ond)?(?:s)?)?)?$/

export function parseTime (source: string) {
  const capture = timeRegExp.exec(source)
  if (!capture) return 0
  return (parseFloat(capture[1]) * week || 0)
    + (parseFloat(capture[2]) * day || 0)
    + (parseFloat(capture[3]) * hour || 0)
    + (parseFloat(capture[4]) * minute || 0)
    + (parseFloat(capture[5]) * second || 0)
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

export function formatContext (meta: Meta<'message'>) {
  return meta.messageType === 'private' ? `私聊 ${meta.userId}`
    : meta.messageType === 'group' ? `群聊 ${meta.groupId}`
    : `讨论组 ${meta.discussId}`
}
