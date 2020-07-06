import { Context } from 'koishi-core'
import { Dialogue } from './database'
import { getDetails, formatDetails, formatAnswer } from './search'

const second = 1000
const minute = second * 60

function formatTime (ms: number) {
  let result: string
  if (ms >= minute - second / 2) {
    ms += second / 2
    result = Math.floor(ms / minute) + 'm'
    if (ms % minute > second) {
      result += Math.floor(ms % minute / second) + 's'
    }
  } else {
    result = Math.round(ms / second) + 's'
  }
  return result
}

export default function apply (ctx: Context) {
  ctx.command('teach')
    .option('-v, --review', '查看最近的修改')
    .option('-V, --revert', '回退最近的修改')

  ctx.before('dialogue/execute', (argv) => {
    const { options, meta } = argv
    if (!options.review && !options.revert) return
    const now = Date.now()
    const output = Object.values(Dialogue.history).filter(d => d._operator === meta.userId).map((d) => {
      const details = getDetails(argv, d)
      const { questionType = '问题', answerType = '回答' } = details
      const { original, answer } = d
      return `${formatTime(now - d._date)} 前${d._type} ${formatDetails(d, details)}${questionType}：${original}，${answerType}：${formatAnswer(answer, argv.config)}`
    })
    if (!output.length) return meta.$send('你最近没有进行过操作。')
    return meta.$send(output.join('\n'))
  })
}
