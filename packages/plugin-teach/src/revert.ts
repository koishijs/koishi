import { Context } from 'koishi-core'
import { Dialogue } from './database'
import { getDetails, formatDetails, formatAnswer } from './search'
import { formatTime, isInteger, parseTime } from 'koishi-utils'

const second = 1000
const minute = second * 60

function formatTimeShort (ms: number) {
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
  const output = dialogues.map((d) => {
    const details = getDetails(argv, d)
    const { questionType = '问题', answerType = '回答' } = details
    const { original, answer } = d
    return `${formatDetails(d, details)}${questionType}：${original}，${answerType}：${formatAnswer(answer, argv.config)}`
  })
  return meta.$send(output.join('\n'))
}

async function revert (dialogues: Dialogue[], argv: Dialogue.Argv) {
  try {
    return argv.meta.$send(await Dialogue.revert(dialogues, argv))
  } catch (err) {
    console.error(err)
    return argv.meta.$send('回退问答中出现问题。')
  }
}

function isIntegerOrInterval (value: string) {
  const n = +value
  return n * 0 === 0 ? !isInteger(n) || n <= 0 : !parseTime(value)
}

export default function apply (ctx: Context) {
  ctx.command('teach')
    .option('-v, --review', '查看最近的修改')
    .option('-V, --revert', '回退最近的修改')
    .option('-l, --last [count]', { isString: true, validate: isIntegerOrInterval })
    .option('-L, --except-last [count]', { isString: true, validate: isIntegerOrInterval })

  ctx.before('dialogue/execute', (argv) => {
    const { options, meta } = argv
    const { last, exceptLast } = options
    const now = Date.now(), lastTime = parseTime(last), exceptTime = parseTime(exceptLast)
    const dialogues = Object.values(Dialogue.history).filter((dialogue) => {
      if (dialogue._operator !== meta.userId) return
      const offset = now - dialogue._timestamp
      if (lastTime && offset >= lastTime) return
      if (exceptTime && offset < exceptTime) return
      return true
    }).sort((d1, d2) => d2._timestamp - d1._timestamp).filter((_, index, temp) => {
      if (!lastTime && last && index >= +last) return
      if (!exceptTime && exceptLast && index < temp.length - +exceptLast) return
      return true
    })

    if (!dialogues.length) return meta.$send('没有搜索到满足条件的教学操作。')
    if (options.review) return review(dialogues, argv)
    if (options.revert) return revert(dialogues, argv)
  })

  ctx.on('dialogue/detail-short', ({ _type, _timestamp }, output, argv) => {
    if (_type) {
      output.unshift(`${_type}-${formatTimeShort(Date.now() - _timestamp)}`)
    }
  })

  ctx.on('dialogue/detail', ({ _type, _timestamp }, output, argv) => {
    if (_type) {
      output.push(`最后一次${_type}于：${formatTime(Date.now() - _timestamp)}前`)
    }
  })
}
