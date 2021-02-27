import { Context } from 'koishi-core'
import { Dialogue, isZeroToOne } from '../utils'

declare module '../utils' {
  interface Dialogue {
    probS: number
    probA: number
  }
}

declare module '../receiver' {
  interface SessionState {
    activated?: Record<number, number>
  }
}

export default function apply(ctx: Context, config: Dialogue.Config) {
  const { appellationTimeout = 20000 } = config

  ctx.command('teach')
    .option('probabilityStrict', '-p <prob>  设置问题的触发权重', { type: isZeroToOne })
    .option('probabilityAppellative', '-P <prob>  设置被称呼时问题的触发权重', { type: isZeroToOne })

  ctx.on('dialogue/modify', ({ options }, data) => {
    if (options.create) {
      data.probS = options.probabilityStrict ?? 1 - +options.appellative
      data.probA = options.probabilityAppellative ?? +options.appellative
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

  ctx.on('dialogue/prepare', ({ test, userId, dialogues, activated }) => {
    const hasNormal = dialogues.some(d => !(d.flag & Dialogue.Flag.regexp))
    dialogues.forEach((dialogue) => {
      if (hasNormal && (dialogue.flag & Dialogue.Flag.regexp)) {
        // 如果存在普通匹配的问答，则所有正则匹配的问答不会触发
        dialogue._weight = 0
      } else if (userId in activated) {
        // 如果已经是激活状态，采用两个概率的最大值
        dialogue._weight = Math.max(dialogue.probS, dialogue.probA)
      } else if (!test.appellative || !(dialogue.flag & Dialogue.Flag.regexp)) {
        // 如果不是正则表达式，或问题不含称呼，则根据是否有称呼决定概率
        dialogue._weight = test.appellative ? dialogue.probA : dialogue.probS
      } else {
        // 对于含有称呼的正则表达式，需要判断正则表达式是否使用了称呼
        // 优先匹配概率更高的版本，如果概率相同则优先匹配 probA 的版本
        // 这里匹配的结果会被存储下来，后面 receiver 用得着
        const regexp = new RegExp(dialogue.question)
        const queue = dialogue.probS >= dialogue.probA
          ? [[test.original, dialogue.probS], [test.question, dialogue.probA]] as const
          : [[test.question, dialogue.probA], [test.original, dialogue.probS]] as const
        for (const [question, weight] of queue) {
          dialogue._capture = regexp.exec(question)
          dialogue._weight = weight
          if (dialogue._capture) break
        }
      }
    })
  })

  ctx.before('dialogue/send', ({ test, activated, userId }) => {
    if (!test.activated) return
    const time = activated[userId] = Date.now()
    ctx.setTimeout(() => {
      if (activated[userId] === time) {
        delete activated[userId]
      }
    }, appellationTimeout)
  })

  ctx.on('dialogue/detail', ({ probS, probA }, output) => {
    if (probS < 1 || probA > 0) output.push(`触发权重：p=${probS}, P=${probA}`)
  })

  ctx.on('dialogue/detail-short', ({ probS, probA }, output) => {
    if (probS < 1) output.push(`p=${probS}`)
    if (probA > 0) output.push(`P=${probA}`)
  })
}
