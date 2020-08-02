import { Context, UserData, UserField } from 'koishi-core'
import { isInteger } from 'koishi-utils'
import { Dialogue } from '../database'

declare module '../database' {
  interface DialogueTest {
    matchAffinity?: number
    mismatchAffinity?: number
  }

  interface Dialogue {
    minAffinity: number
    maxAffinity: number
  }

  namespace Dialogue {
    interface Config {
      affinityFields?: Iterable<UserField>
      getAffinity? (user: Partial<UserData>): number
    }
  }
}

declare module '../receiver' {
  interface SessionState {
    noAffinityTest?: boolean
  }
}

export function isShortInteger (value: any) {
  return isInteger(value) && value >= 0 ? '' : '应为正整数。'
}

export default function apply (ctx: Context, config: Dialogue.Config) {
  const { getAffinity, affinityFields = [] } = config
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

  function matchAffinity (affinity: number) {
    return `(\`maxAffinity\` > ${affinity} && \`minAffinity\` <= ${affinity})`
  }

  ctx.on('dialogue/before-fetch', (test, conditionals) => {
    if (test.matchAffinity !== undefined) {
      conditionals.push(matchAffinity(test.matchAffinity))
    }
    if (test.mismatchAffinity !== undefined) {
      conditionals.push('!' + matchAffinity(test.mismatchAffinity))
    }
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
    if (dialogue.minAffinity > 0) output.push(`a=${dialogue.minAffinity}`)
    if (dialogue.maxAffinity < 32768) output.push(`A=${dialogue.maxAffinity}`)
  })

  ctx.on('dialogue/before-attach-user', (state, fields) => {
    if (state.dialogue) return
    // 如果所有可能触发的问答都不涉及好感度，则无需获取好感度字段
    if (state.noAffinityTest = state.dialogues.every(d => !d._weight || !d.minAffinity && d.maxAffinity === 32768)) return
    for (const field of affinityFields) {
      fields.add(field)
    }
  })

  ctx.on('dialogue/attach-user', ({ meta, dialogues, noAffinityTest }) => {
    if (noAffinityTest) return
    const affinity = getAffinity(meta.$user)
    dialogues.forEach((dialogue) => {
      if (dialogue.minAffinity <= affinity && dialogue.maxAffinity > affinity) return
      dialogue._weight = 0
    })
  })
}
