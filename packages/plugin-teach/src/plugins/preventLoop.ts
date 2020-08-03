import { Context } from 'koishi-core'
import { Dialogue } from '../database'

export interface LoopConfig {
  participants: number
  length: number
  debounce?: number
}

declare module '../database' {
  namespace Dialogue {
    interface Config {
      preventLoop?: number | LoopConfig | LoopConfig[]
    }
  }
}

declare module '../receiver' {
  interface SessionState {
    initiators: number[]
    loopTimestamp: number
  }
}

export default function apply (ctx: Context, config: Dialogue.Config) {
  const { preventLoop } = config

  const preventLoopConfig: LoopConfig[] = !preventLoop ? []
    : typeof preventLoop === 'number' ? [{ length: preventLoop, participants: 1 }]
    : Array.isArray(preventLoop) ? preventLoop
    : [preventLoop]
  const initiatorCount = Math.max(0, ...preventLoopConfig.map(c => c.length))

  ctx.on('dialogue/state', (state) => {
    state.initiators = []
  })

  ctx.on('dialogue/receive', (state) => {
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

  ctx.on('dialogue/before-send', (state) => {
    if (state.session.$_redirected) return
    state.initiators.unshift(state.userId)
    state.initiators.splice(initiatorCount, Infinity)
    state.loopTimestamp = null
  })
}
