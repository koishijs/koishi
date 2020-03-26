import { Context } from 'koishi-core'
import { TeachConfig } from '../utils'

export interface LoopConfig {
  participants: number
  length: number
  debounce?: number
}

declare module '../utils' {
  interface TeachConfig {
    preventLoop?: number | LoopConfig | LoopConfig[]
  }
}

declare module '../receiver' {
  interface SessionState {
    initiators: number[]
    loopTimestamp: number
  }
}

export default function apply (ctx: Context, config: TeachConfig) {
  const { preventLoop } = config

  const preventLoopConfig: LoopConfig[] = !preventLoop ? []
    : typeof preventLoop === 'number' ? [{ length: preventLoop, participants: 1 }]
    : Array.isArray(preventLoop) ? preventLoop
    : [preventLoop]
  const initiatorCount = Math.max(0, ...preventLoopConfig.map(c => c.length))

  ctx.on('dialogue/state', (state) => {
    state.initiators = []
  })

  ctx.on('dialogue/receive', (meta, test, state) => {
    const timestamp = Date.now()
    for (const { participants, length, debounce } of preventLoopConfig) {
      if (state.initiators.length < length) break
      const initiators = new Set(state.initiators.slice(0, length))
      if (initiators.size <= participants
        && initiators.has(meta.userId)
        && !(debounce > timestamp - state.loopTimestamp)) {
        state.loopTimestamp = timestamp
        return true
      }
    }
  })

  ctx.on('dialogue/send', (meta, dialogue, state) => {
    state.initiators.unshift(meta.userId)
    state.initiators.splice(initiatorCount, Infinity)
    state.loopTimestamp = null
  })
}
