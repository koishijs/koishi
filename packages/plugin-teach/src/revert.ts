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

function review (dialogues: Dialogue[], argv: Dialogue.Argv) {
  const { meta } = argv
  const output = dialogues.sort((d1, d2) => d2._timestamp - d1._timestamp).map((d) => {
    const details = getDetails(argv, d)
    const { questionType = '问题', answerType = '回答' } = details
    const { original, answer } = d
    return `${formatDetails(d, details)}${questionType}：${original}，${answerType}：${formatAnswer(answer, argv.config)}`
  })
  return meta.$send(output.join('\n'))
}

async function revert (dialogues: Dialogue[], argv: Dialogue.Argv) {
  const created = dialogues.filter(d => d._type === '添加')
  const edited = dialogues.filter(d => d._type !== '添加')
  try {
    await Dialogue.remove(created.map(d => d.id), argv, true)
    await argv.ctx.database.mysql.update('dialogue', edited)
    return argv.meta.$send(`问答 ${dialogues.map(d => d.id)} 已回退完成。`)
  } catch (err) {
    console.error(err)
    return argv.meta.$send('回退问答中出现问题。')
  }
}

export default function apply (ctx: Context) {
  ctx.command('teach')
    .option('-v, --review', '查看最近的修改')
    .option('-V, --revert', '回退最近的修改')

  ctx.before('dialogue/execute', (argv) => {
    const { options, meta } = argv
    const dialogues = Object.values(Dialogue.history).filter(d => d._operator === meta.userId)
    if (!dialogues.length) return meta.$send('你最近没有进行过教学操作。')
    if (options.review) return review(dialogues, argv)
    if (options.revert) return revert(dialogues, argv)
  })

  ctx.on('dialogue/detail-short', ({ _type, _timestamp }, output, argv) => {
    if (_type) {
      output.unshift(`${_type}-${formatTime(Date.now() - _timestamp)}`)
    }
  })
}
