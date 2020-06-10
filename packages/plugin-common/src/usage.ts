import { Context } from 'koishi-core'

export default function apply (ctx: Context) {
  ctx.command('usage [...commands]', '查看指令的调用次数')
    .action(async ({ meta }, ...commands) => {
      const { usage } = meta.$user
      if (!commands.length) commands = Object.keys(usage)
      const output: string[] = []
      for (const name of commands.sort()) {
        const data = usage[name]
        if (!data) {
          output.push(`${name}：0 次`)
        } else if (data.count) {
          output.push(`${name}：${data.count} 次`)
        }
      }
      if (!output.length) return meta.$send('你今日没有调用过消耗次数的指令。')
      output.unshift('你今日各指令的调用次数为：')
      return meta.$send(output.join('\n'))
    })
}
