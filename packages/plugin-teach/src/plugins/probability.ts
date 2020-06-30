import { Context } from 'koishi-core'
import { isZeroToOne, TeachConfig } from '../utils'
import { DialogueFlag } from '../database'

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

  ctx.on('dialogue/attach-user', ({ test, userId, dialogues, activated }) => {
    dialogues.forEach((dialogue) => {
      if (userId in activated) {
        // 如果已经是激活状态，采用两个概率的最大值
        dialogue._weight = Math.max(dialogue.probS, dialogue.probA)
      } else if (!test.appellative || !(dialogue.flag & DialogueFlag.regexp)) {
        // 如果不是正则表达式，或肯定无称呼，则根据是否有称呼决定概率
        dialogue._weight = test.appellative ? dialogue.probA : dialogue.probS
      } else {
        // 对于有称呼的正则表达式，需要判断正则表达式是否含有称呼
        dialogue._weight = dialogue._strict ? dialogue.probS : dialogue.probA
      }
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
