import { Context } from 'koishi-core'

declare module '../database' {
  interface DialogueTest {
    matchTime?: number
    mismatchTime?: number
  }

  interface Dialogue {
    startTime: number
    endTime: number
  }
}

export function isHours (value: string) {
  if (!/^\d+(:\d+)?$/.test(value)) return true
  const [_hours, _minutes = '0'] = value.split(':')
  const hours = +_hours, minutes = +_minutes
  return !(hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60)
}

export default function apply (ctx: Context) {
  ctx.command('teach')
    .option('-t, --start-time, --match-time <time>', { isString: true, validate: isHours })
    .option('-T, --end-time, --mismatch-time <time>', { isString: true, validate: isHours })

  function parseTime (source: string) {
    const [hours, minutes = '0'] = source.split(':')
    return +hours * 60 + +minutes
  }

  ctx.on('dialogue/search', ({ options }, test) => {
    if (options.matchTime !== undefined) test.matchTime = parseTime(options.matchTime)
    if (options.mismatchTime !== undefined) test.mismatchTime = parseTime(options.mismatchTime)
  })

  ctx.on('dialogue/receive', (state) => {
    const date = new Date()
    state.test.matchTime = date.getHours() * 60 + date.getMinutes()
  })

  function getProduct (time: number) {
    return `(\`startTime\`-${time})*(${time}-\`endTime\`)*(\`endTime\`-\`startTime\`)`
  }

  ctx.on('dialogue/before-fetch', (test, conditionals) => {
    if (test.matchTime !== undefined) {
      conditionals.push(getProduct(test.matchTime) + '>=0')
    }
    if (test.mismatchTime !== undefined) {
      conditionals.push(getProduct(test.matchTime) + '<0')
    }
  })

  ctx.on('dialogue/modify', async ({ options }, data) => {
    if (options.startTime !== undefined) data.startTime = parseTime(options.startTime)
    if (options.endTime !== undefined) data.endTime = parseTime(options.endTime)
  })

  function formatTime (time: number) {
    const hours = Math.floor(time / 60)
    const minutes = time - hours * 60
    return `${hours}:${minutes.toString().padStart(2, '0')}`
  }

  ctx.on('dialogue/detail', (dialogue, output) => {
    if (dialogue.startTime === dialogue.endTime) return
    output.push(`触发时段：${formatTime(dialogue.startTime)}-${formatTime(dialogue.endTime)}`)
  })

  ctx.on('dialogue/detail-short', (dialogue, output) => {
    if (dialogue.startTime === dialogue.endTime) return
    output.push(`${formatTime(dialogue.startTime)}-${formatTime(dialogue.endTime)}`)
  })
}
