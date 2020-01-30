import { Context } from 'koishi-core'

export default function apply (ctx: Context) {
  ctx.command('exit', '停止机器人运行', { authority: 4 })
    .option('-c, --code [code]', '设置 exit code')
    .shortcut('关机', { prefix: true, options: { code: 0 } })
    .shortcut('重启', { prefix: true, options: { code: -1 } })
    .action(({ options }) => {
      process.exit(+options.code)
    })
}
