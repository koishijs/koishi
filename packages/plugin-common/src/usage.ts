import { Context } from 'koishi-core'

export function apply(ctx: Context) {
  ctx.command('usage [...commands]', '查看指令的调用次数')
    .userFields(['usage'])
    .before(session => !session.$app.database)
    .shortcut('调用次数', { fuzzy: true })
    .action(async ({ session }, ...commands) => {
      const { usage } = session.$user
      if (!commands.length) commands = Object.keys(usage)
      const output: string[] = []
      for (const name of commands.sort()) {
        if (name.startsWith('$')) continue
        output.push(`${name}：${usage[name] || 0} 次`)
      }
      if (!output.length) return '你今日没有调用过消耗次数的指令。'
      output.unshift('你今日各指令的调用次数为：')
      return output.join('\n')
    })
}
