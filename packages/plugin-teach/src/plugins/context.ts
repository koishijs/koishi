import { Context } from 'koishi-core'
import { contain, intersection } from 'koishi-utils'
import { DialogueFlag } from '../database'
import { idEqual } from '../utils'

export default function apply (ctx: Context) {
  ctx.on('dialogue/filter', (data, test, state) => {
    if (test.successors && !contain(data.successors, test.successors)) return true
    if (state && Object.keys(state.predecessors).includes('' + data.id)) return
    if (!test.groups) return
    const sameFlag = !(data.flag & DialogueFlag.reversed) !== test.reversed
    if (test.partial) {
      return sameFlag
        ? !contain(data.groups, test.groups)
        : !!intersection(data.groups, test.groups).length
    } else {
      return !sameFlag || !idEqual(test.groups, data.groups)
    }
  })
}
