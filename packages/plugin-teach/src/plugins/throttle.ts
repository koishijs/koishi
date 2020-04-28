import { Context } from 'koishi-core'
import { TeachConfig } from '../utils'

export interface ThrottleConfig {
  interval: number
  responses: number
}

declare module '../utils' {
  interface TeachConfig {
    throttle?: ThrottleConfig | ThrottleConfig[]
  }
}

declare module '../receiver' {
  interface SessionState {
    counters: Record<number, number>
  }
}

export default function apply (ctx: Context, config: TeachConfig) {
  const { throttle } = config

  const throttleConfig = !throttle ? []
    : Array.isArray(throttle) ? throttle
    : [throttle]
  const counters: Record<number, number> = {}
  for (const { interval, responses } of throttleConfig) {
    counters[interval] = responses
  }

  ctx.on('dialogue/state', (state) => {
    state.counters = { ...counters }
  })

  ctx.on('dialogue/receive', ({ counters }) => {
    for (const interval in counters) {
      if (counters[interval] <= 0) return true
    }
  })

  ctx.on('dialogue/before-send', ({ counters }) => {
    for (const { interval } of throttleConfig) {
      counters[interval]--
      setTimeout(() => counters[interval]++, interval)
    }
  })
}
