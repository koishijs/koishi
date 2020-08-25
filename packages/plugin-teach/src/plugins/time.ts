import { Context } from 'koishi-core'
import { Dialogue } from '../utils'

declare module '../utils' {
  interface DialogueTest {
    matchTime?: number
    mismatchTime?: number
  }

  interface Dialogue {
    startTime: number
    endTime: number
  }

  namespace Dialogue {
    interface Config {
      useTime?: boolean
    }
  }
}

export function isHours(value: string) {
  if (!/^\d+(:\d+)?$/.test(value)) return true
  const [_hours, _minutes = '0'] = value.split(':')
  const hours = +_hours, minutes = +_minutes
  return !(hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60)
}

export default function apply(ctx: Context, config: Dialogue.Config) {
  if (config.useTime === false) return

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

  ctx.on('dialogue/modify', async ({ options }, data) => {
    if (options.startTime !== undefined) {
      data.startTime = parseTime(options.startTime)
    } else if (options.create) {
      data.startTime = 0
    }

    if (options.endTime !== undefined) {
      data.endTime = parseTime(options.endTime)
    } else if (options.create) {
      data.endTime = 0
    }
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
