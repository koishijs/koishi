import { Context } from 'koishi-core'
import { isZeroToOne, TeachConfig } from '../utils'

declare module '../database' {
  interface Dialogue {
    probS: number
    probA: number
  }
}

declare module '../receiver' {
  interface SessionState {
    activated: Record<number, number>
  }
}

export default function apply (ctx: Context, config: TeachConfig) {
  const { appellationTimeout = 20000 } = config

  ctx.command('teach')
    .option('-p, --probability-strict <prob>', '设置问题的触发权重', { validate: isZeroToOne })
    .option('-P, --probability-appellative <prob>', '设置被称呼时问题的触发权重', { validate: isZeroToOne })

  ctx.before('dialogue/modify', ({ options, target, appellative }, data) => {
    if (!target && appellative) {
      data.probS = options.probabilityStrict ?? 0
      data.probA = options.probabilityAppellative ?? 1
    } else {
      if (options.probabilityStrict !== undefined) {
        data.probS = options.probabilityStrict
      }
      if (options.probabilityAppellative !== undefined) {
        data.probA = options.probabilityAppellative
      }
    }
  })

  ctx.on('dialogue/state', (state) => {
    state.activated = {}
  })

  ctx.on('dialogue/search', (argv, test) => {
    test.appellative = argv.appellative
  })

  ctx.on('dialogue/before-attach-user', ({ test, userId, dialogues, activated }) => {
    dialogues.forEach((dialogue) => {
      dialogue._weight = userId in activated
        ? Math.max(dialogue.probS, dialogue.probA)
        : test.appellative ? dialogue.probA : dialogue.probS
    })
  })

  ctx.on('dialogue/before-send', ({ test, activated, userId }) => {
    if (test.activated) {
      const time = activated[userId] = Date.now()
      setTimeout(() => {
        if (activated[userId] === time) {
          delete activated[userId]
        }
      }, appellationTimeout)
    }
  })

  ctx.on('dialogue/detail', ({ probS, probA }, output) => {
    if (probS < 1 || probA > 0) output.push(`触发权重：p=${probS}, P=${probA}`)
  })

  ctx.on('dialogue/detail-short', ({ probS, probA }, output) => {
    if (probS < 1) output.push(`p=${probS}`)
    if (probA > 0) output.push(`P=${probA}`)
  })
}
