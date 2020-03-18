import { Context } from 'koishi-core'
import { TeachConfig } from '../utils'

export interface LoopConfig {
  participants: number
  length: number
}

declare module '../utils' {
  interface TeachConfig {
    preventLoop?: number | LoopConfig | LoopConfig[]
  }
}

declare module '../receiver' {
  interface SessionState {
    initiators: number[]
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
    for (const { participants, length } of preventLoopConfig) {
      if (state.initiators.length < length) break
      const initiators = new Set(state.initiators.slice(0, length))
      if (initiators.size <= participants && initiators.has(meta.userId)) return true
    }
  })

  ctx.on('dialogue/send', (meta, dialogue, state) => {
    state.initiators.unshift(meta.userId)
    state.initiators.splice(initiatorCount, Infinity)
  })
}
