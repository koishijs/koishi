import { Context } from 'koishi-core'

declare module '../utils' {
  interface DialogueTest {
    matchTime?: number
    mismatchTime?: number
  }

  interface Dialogue {
    startTime: number
    endTime: number
  }
}

export function isHours(value: string) {
  if (!/^\d+(:\d+)?$/.test(value)) return true
  const [_hours, _minutes = '0'] = value.split(':')
  const hours = +_hours, minutes = +_minutes
  return !(hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60)
}

export default function apply(ctx: Context) {
  ctx.command('teach')
    .option('startTime', '-t <time>  起始时间', { type: 'string', validate: isHours })
    .option('endTime', '-T <time>  结束时间', { type: 'string', validate: isHours })

  function parseTime(source: string) {
    const [hours, minutes = '0'] = source.split(':')
    return +hours * 60 + +minutes
  }

  ctx.on('dialogue/before-search', ({ options }, test) => {
    if (options.startTime !== undefined) test.matchTime = parseTime(options.startTime)
    if (options.endTime !== undefined) test.mismatchTime = parseTime(options.endTime)
  })

  ctx.on('dialogue/receive', (state) => {
    const date = new Date()
    state.test.matchTime = date.getHours() * 60 + date.getMinutes()
  })

  function getProduct(time: number) {
    return `(\`startTime\`-${time})*(${time}-\`endTime\`)*(\`endTime\`-\`startTime\`)`
  }

  ctx.on('dialogue/mysql', (test, conditionals) => {
    if (test.matchTime !== undefined) {
      conditionals.push(getProduct(test.matchTime) + '>=0')
    }
    if (test.mismatchTime !== undefined) {
      conditionals.push(getProduct(test.matchTime) + '<0')
    }
  })

  ctx.on('dialogue/mongo', (test, conditionals) => {
    const expr = {
      $multiply: [
        { $subtract: ['$endTime', '$startTime'] },
        { $subtract: ['$startTime', test.matchTime] },
        { $subtract: [test.matchTime, '$endTime'] },
      ],
    }
    if (test.matchTime !== undefined) {
      conditionals.push({ $expr: { $gte: [expr, 0] } })
    }
    if (test.matchTime !== undefined) {
      conditionals.push({ $expr: { $lt: [expr, 0] } })
    }
  })

  ctx.on('dialogue/modify', async ({ options }, data) => {
    if (options.startTime !== undefined) data.startTime = parseTime(options.startTime)
    if (options.endTime !== undefined) data.endTime = parseTime(options.endTime)
  })

  function formatTime(time: number) {
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
