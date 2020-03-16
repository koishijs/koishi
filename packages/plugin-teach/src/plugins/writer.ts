import { Context } from 'koishi-core'
import { DialogueFlag } from '../database'

export default function apply (ctx: Context) {
  ctx.on('dialogue/filter', (data, test) => {
    if (test.writer && data.writer !== test.writer) return true
    if (test.frozen !== undefined && test.frozen === !(data.flag & DialogueFlag.frozen)) return true
  })
}
