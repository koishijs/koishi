import { Context, makeArray } from 'koishi'
import { Dialogue } from '../utils'

export interface ThrottleConfig {
  interval: number
  responses: number
}

export interface LoopConfig {
  participants: number
  length: number
  debounce?: number
}

declare module '../utils' {
  namespace Dialogue {
    interface Config {
      throttle?: ThrottleConfig | ThrottleConfig[]
      preventLoop?: number | LoopConfig | LoopConfig[]
    }
  }
}

declare module '../receiver' {
  interface SessionState {
    counters?: Record<number, number>
    initiators?: string[]
    loopTimestamp?: number
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

  ctx.before('dialogue/send', ({ counters, session }) => {
    if (session._redirected) return
    for (const { interval } of throttleConfig) {
      counters[interval]--
      setTimeout(() => counters[interval]++, interval)
    }
  })

  const { preventLoop } = config

  const preventLoopConfig: LoopConfig[] = !preventLoop ? []
    : typeof preventLoop === 'number' ? [{ length: preventLoop, participants: 1 }]
      : makeArray(preventLoop)
  const initiatorCount = Math.max(0, ...preventLoopConfig.map(c => c.length))

  ctx.on('dialogue/state', (state) => {
    state.initiators = []
  })

  ctx.on('dialogue/receive', (state) => {
    if (state.session._redirected) return
    const timestamp = Date.now()
    for (const { participants, length, debounce } of preventLoopConfig) {
      if (state.initiators.length < length) break
      const initiators = new Set(state.initiators.slice(0, length))
      if (initiators.size <= participants
        && initiators.has(state.userId)
        && !(debounce > timestamp - state.loopTimestamp)) {
        state.loopTimestamp = timestamp
        return true
      }
    }
  })

  ctx.before('dialogue/send', (state) => {
    if (state.session._redirected) return
    state.initiators.unshift(state.userId)
    state.initiators.splice(initiatorCount, Infinity)
    state.loopTimestamp = null
  })
}
