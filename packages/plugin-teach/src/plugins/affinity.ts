import { Context, User } from 'koishi-core'
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
      affinityFields?: Iterable<User.Field>
      getAffinity? (user: Partial<User>): number
    }
  }
}

declare module '../receiver' {
  interface SessionState {
    noAffinityTest?: boolean
  }
}

export function isShortInteger(value: any) {
  return isInteger(value) && value >= 0 ? '' : '应为正整数。'
}

export default function apply(ctx: Context, config: Dialogue.Config) {
  const { getAffinity, affinityFields = [] } = config
  if (!getAffinity) return

  ctx.command('teach')
    .option('minAffinity', '-a <aff>  最小好感度', { validate: isShortInteger })
    .option('maxAffinity', '-A <aff>  最大好感度', { validate: isShortInteger })

  ctx.on('dialogue/validate', ({ options }) => {
    if (options.maxAffinity === 0) options.maxAffinity = 32768
  })

  ctx.on('dialogue/before-search', ({ options }, test) => {
    if (options.minAffinity !== undefined) test.matchAffinity = options.minAffinity
    if (options.maxAffinity !== undefined) test.mismatchAffinity = options.maxAffinity
  })

  function matchAffinity(affinity: number) {
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
    // eslint-disable-next-line no-cond-assign
    if (state.noAffinityTest = state.dialogues.every(d => !d._weight || !d.minAffinity && d.maxAffinity === 32768)) return
    for (const field of affinityFields) {
      fields.add(field)
    }
  })

  ctx.on('dialogue/attach-user', ({ session, dialogues, noAffinityTest }) => {
    if (noAffinityTest) return
    const affinity = getAffinity(session.$user)
    dialogues.forEach((dialogue) => {
      if (dialogue.minAffinity <= affinity && dialogue.maxAffinity > affinity) return
      dialogue._weight = 0
    })
  })
}
