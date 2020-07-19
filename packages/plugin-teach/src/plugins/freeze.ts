import { Context } from 'koishi-core'
import { DialogueFlag, useFlag } from '../database'

declare module '../database' {
  interface DialogueTest {
    frozen?: boolean
  }
}

export default function apply (ctx: Context) {
  ctx.command('teach')
    .option('-f, --frozen', '锁定这个问答', { authority: 4 })
    .option('-F, --no-frozen', '解锁这个问答', { authority: 4 })

  useFlag(ctx, 'frozen')

  ctx.on('dialogue/permit', ({ meta }, dialogue) => {
    return (dialogue.flag & DialogueFlag.frozen) && meta.$user.authority < 4
  })

  ctx.on('dialogue/detail', (dialogue, output) => {
    if (dialogue.flag & DialogueFlag.frozen) output.push('此问答已锁定。')
  })

  ctx.on('dialogue/detail-short', (dialogue, output) => {
    if (dialogue.flag & DialogueFlag.frozen) output.push('锁定')
  })
}
