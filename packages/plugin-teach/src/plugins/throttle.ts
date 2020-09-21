import { Context } from 'koishi-core'
import { makeArray } from 'koishi-utils'
import { Dialogue } from '../utils'

export interface ThrottleConfig {
  interval: number
  responses: number
}

declare module '../utils' {
  namespace Dialogue {
    interface Config {
      throttle?: ThrottleConfig | ThrottleConfig[]
    }
  }
}

declare module '../receiver' {
  interface SessionState {
    counters: Record<number, number>
  }
}

export default function apply(ctx: Context, config: Dialogue.Config) {
  const throttleConfig = makeArray(config.throttle)
  const counters: Record<number, number> = {}
  for (const { interval, responses } of throttleConfig) {
    counters[interval] = responses
  }

  ctx.on('dialogue/state', (state) => {
    state.counters = { ...counters }
  })

  ctx.on('dialogue/receive', ({ counters, session }) => {
    if (session._redirected) return
    for (const interval in counters) {
      if (counters[interval] <= 0) return true
    }
  })

  ctx.on('dialogue/before-send', ({ counters, session }) => {
    if (session._redirected) return
    for (const { interval } of throttleConfig) {
      counters[interval]--
      setTimeout(() => counters[interval]++, interval)
    }
  })
}
