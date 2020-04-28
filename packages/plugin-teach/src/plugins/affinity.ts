import { Context, UserData } from 'koishi-core'
import { Dialogue } from '../database'
import { isInteger } from 'koishi-utils'
import { TeachConfig } from '../utils'

declare module '../database' {
  interface DialogueTest {
    matchAffinity?: number
    mismatchAffinity?: number
  }

  interface Dialogue {
    minAffinity: number
    maxAffinity: number
  }
}

declare module '../utils' {
  interface TeachConfig {
    getAffinity? (user: UserData): number
  }
}

export function isShortInteger (value: any) {
  return isInteger(value) && value >= 0 ? '' : '应为正整数。'
}

export default function apply (ctx: Context, config: TeachConfig) {
  const { getAffinity } = config
  if (!getAffinity) return

  ctx.command('teach')
    .option('-a, --min-affinity, --match-affinity <aff>', { validate: isShortInteger })
    .option('-A, --max-affinity, --mismatch-affinity <aff>', { validate: isShortInteger })

  ctx.on('dialogue/validate', ({ options }) => {
    if (options.maxAffinity === 0) options.maxAffinity = 32768
  })

  ctx.on('dialogue/before-search', ({ options }, test) => {
    if (options.matchAffinity !== undefined) test.matchAffinity = options.matchAffinity
    if (options.mismatchAffinity !== undefined) test.mismatchAffinity = options.mismatchAffinity
  })

  function matchAffinity (dialogue: Dialogue, affinity: number) {
    return dialogue.minAffinity <= affinity && dialogue.maxAffinity > affinity
  }

  ctx.on('dialogue/filter', (dialogue, test) => {
    if (test.matchAffinity !== undefined && !matchAffinity(dialogue, test.matchAffinity)) return true
    if (test.mismatchAffinity !== undefined && matchAffinity(dialogue, test.mismatchAffinity)) return true
  })

  ctx.on('dialogue/modify', async ({ options }, data) => {
    if (options.minAffinity !== undefined) data.minAffinity = options.minAffinity
    if (options.maxAffinity !== undefined) data.maxAffinity = options.maxAffinity
  })

  ctx.on('dialogue/detail', (dialogue, output) => {
    if (dialogue.minAffinity > 0) output.push(`最低好感度：${dialogue.minAffinity}`)
    if (dialogue.maxAffinity < 32768) output.push(`最高好感度：${dialogue.maxAffinity}`)
  })

  ctx.on('dialogue/detail-short', (dialogue, output) => {
    if (dialogue.minAffinity > 0) output.push(`m=${dialogue.minAffinity}`)
    if (dialogue.maxAffinity < 32768) output.push(`M=${dialogue.maxAffinity}`)
  })

  ctx.on('dialogue/attach-user', ({ meta, dialogues }) => {
    const affinity = getAffinity(meta.$user)
    dialogues.forEach((dialogue) => {
      if (dialogue.minAffinity <= affinity && dialogue.maxAffinity > affinity) return
      dialogue._weight = 0
    })
  })
}
