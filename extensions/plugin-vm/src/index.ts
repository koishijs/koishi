import { Context, userFields } from 'koishi-core'
import { CQCode } from 'koishi-utils'
import { Worker } from 'worker_threads'
import { wrap, Remote, Endpoint, expose, proxy } from './comlink'
import { WorkerAPI, Options } from './worker'

export const name = 'vm'

export function apply (ctx: Context, options: Options = {}) {
  let api: Remote<WorkerAPI>
  ctx.on('before-connect', async () => {
    const worker = new Worker(__dirname + '/worker.js')
    api = wrap(worker)
    await api.init(options)
  })
  
  ctx.command('eval <expression...>', '执行 JavaScript 脚本', { authority: 3 })
    .userFields(userFields)
    .shortcut('>', { oneArg: true, fuzzy: true })
    .shortcut('>>', { oneArg: true, fuzzy: true, options: { output: true } })
    .option('-o, --output', '输出最后的结果')
    .action(async ({ meta, options }, expression) => {
      if (!expression) return

      await api.eval(CQCode.unescape(expression), proxy({
        user: meta.$user,
        send: (message: string) => meta.$send(message),
        execute: (message: string) => meta.$app.execute(message, meta)
      }), options.output)
    })
}
