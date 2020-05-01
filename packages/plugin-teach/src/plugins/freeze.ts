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
    .option('-F, --no-frozen', '解锁这个问答', { authority: 4 })

  ctx.on('dialogue/before-fetch', (test, conditionals) => {
    if (test.frozen !== undefined) {
      conditionals.push(`!(\`flag\` & ${DialogueFlag.frozen}) = !${test.frozen}`)
    }
  })

  ctx.on('dialogue/permit', ({ meta }, dialogue) => {
    return (dialogue.flag & DialogueFlag.frozen) && meta.$user.authority < 4
  })

  ctx.on('dialogue/modify', ({ options }, data) => {
    if (options.frozen !== undefined) {
      data.flag &= ~DialogueFlag.frozen
      data.flag |= +options.frozen * DialogueFlag.frozen
    }
  })

  ctx.on('dialogue/search', ({ options }, test) => {
    test.frozen = options.frozen
  })

  ctx.on('dialogue/detail', (dialogue, output) => {
    if (dialogue.flag & DialogueFlag.frozen) output.push('此问题已锁定。')
  })

  ctx.on('dialogue/detail-short', (dialogue, output) => {
    if (dialogue.flag & DialogueFlag.frozen) output.push('锁定')
  })
}
