import { Context, userFields, MessageBuffer } from 'koishi-core'
import { CQCode, Logger, defineProperty } from 'koishi-utils'
import { Worker, ResourceLimits } from 'worker_threads'
import { wrap, Remote, proxy } from './comlink'
import { WorkerAPI, WorkerConfig } from './worker'

declare module 'koishi-core/dist/meta' {
  interface Meta {
    _eval: boolean
  }
}

export interface Config extends WorkerConfig {
  timeout?: number
  resourceLimits?: ResourceLimits
}

const defaultConfig: Config = {
  timeout: 1000,
}

const logger = Logger.create('eval')

export const name = 'eval'

export function apply (ctx: Context, config: Config = {}) {
  let worker: Worker
  let remote: Remote<WorkerAPI>
  config = { ...defaultConfig, ...config }
  const resourceLimits = {
    ...defaultConfig.resourceLimits,
    ...config.resourceLimits,
  }

  function createWorker () {
    worker = new Worker(__dirname + '/worker.js', {
      workerData: config,
      resourceLimits,
    })
    remote = wrap(worker)
    logger.info('worker started')
    worker.on('exit', (code) => {
      logger.info('exited with code', code)
      createWorker()
    })
  }

  ctx.on('before-connect', () => {
    createWorker()
  })

  ctx.command('eval <expression...>', '执行 JavaScript 脚本', { authority: 2 })
    .userFields(userFields)
    .shortcut('>', { oneArg: true, fuzzy: true })
    .shortcut('>>', { oneArg: true, fuzzy: true, options: { output: true } })
    .option('-o, --output', '输出最后的结果')
    .action(async ({ meta, options }, expression) => {
      if (!expression) return meta.$send('请输入要执行的脚本。')
      if (meta._eval) return meta.$send('不能在 eval 中嵌套调用本指令。')

      const buffer = new MessageBuffer(meta)
      return new Promise((resolve) => {
        defineProperty(meta, '_eval', true)

        const timer = setTimeout(async () => {
          await worker.terminate()
          await buffer.end()
          if (!buffer.hasSent) {
            await meta.$send('计算超时。')
          }
          resolve()
        }, config.timeout)

        remote.eval({
          user: JSON.stringify(meta.$user),
          output: options.output,
          source: CQCode.unescape(expression),
        }, proxy({
          send: (message: string) => meta.$send(message),
          execute: (message: string) => buffer.run(() => meta.$app.execute(message, meta)),
          execute: (message: string) => meta.$app.execute(message, meta),
        })).then(async () => {
          clearTimeout(timer)
          await buffer.end()
          resolve()
        }, () => {
          // TODO catch callback
        })
      }).finally(() => {
        meta._eval = false
      })
    })
}
