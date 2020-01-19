import { Context } from 'koishi-core'
import { CQCode } from 'koishi-utils'
import { exec } from 'child_process'

export default function apply (ctx: Context) {
  ctx.command('exec <expression...>', '执行命令行', { authority: 4 })
    .shortcut('$', { fuzzy: true, oneArg: true })
    .action(async ({ meta }, expression) => {
      if (!expression) return
      expression = CQCode.unescape(expression)
      return new Promise((resolve) => {
        const child = exec(expression, { cwd: process.cwd() })
        child.stdout.on('data', data => meta.$send(String(data).trim()))
        child.stderr.on('data', data => meta.$send(String(data).trim()))
        child.on('close', resolve)
      })
    })
}
