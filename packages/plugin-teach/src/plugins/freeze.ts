import { Context } from 'koishi-core'
import { DialogueFlag } from '../database'

declare module '../database' {
  interface DialogueTest {
    frozen?: boolean
  }
}

export default function apply (ctx: Context) {
  ctx.command('teach')
    .option('-f, --frozen', '锁定这个问答', { authority: 4 })
    .option('-F, --no-frozen', '解锁这个问答', { authority: 4, noNegated: true })

  ctx.on('dialogue/filter', (data, test) => {
    if (test.frozen !== undefined && test.frozen === !(data.flag & DialogueFlag.frozen)) return true
  })

  ctx.on('dialogue/permit', (user, dialogue) => {
    return (dialogue.flag & DialogueFlag.frozen) && user.authority < 4
  })

  ctx.on('dialogue/modify', ({ options }, data) => {
    if (options.frozen !== undefined) {
      data.flag &= ~DialogueFlag.frozen
      data.flag |= +options.frozen * DialogueFlag.frozen
    }
  })

  ctx.on('dialogue/before-search', ({ options }, test) => {
    test.frozen = options.frozen
  })

  ctx.on('dialogue/detail', (dialogue, output) => {
    if (dialogue.flag & DialogueFlag.frozen) output.push('此问题已锁定。')
  })
}
