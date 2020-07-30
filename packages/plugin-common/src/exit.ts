import { Context } from 'koishi-core'

export default function apply (ctx: Context) {
  ctx.command('exit', '停止机器人运行', { authority: 4 })
    .option('-r, --restart', '重新启动')
    .shortcut('关机', { prefix: true })
    .shortcut('重启', { prefix: true, options: { restart: true } })
    .action(({ options }) => {
      process.exit(options.restart ? 514 : 0)
    })
}
