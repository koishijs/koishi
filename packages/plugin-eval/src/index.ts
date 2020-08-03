import { Context, User, Meta } from 'koishi-core'
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
  maxLogs?: number
  resourceLimits?: ResourceLimits
}

const defaultConfig: Config = {
  timeout: 1000,
  maxLogs: 10,
  resourceLimits: {
    maxOldGenerationSizeMb: 64,
    maxYoungGenerationSizeMb: 64,
  }
}

const logger = Logger.create('eval')

export class MainAPI {
  static config: Config

  public logCount = 0

  constructor (private meta: Meta) {

  }

  send (message: string) {
    if (MainAPI.config.maxLogs > this.logCount++) {
      return this.meta.$send(message)
    }
  }

  async execute (message: string) {
    const send = this.meta.$send
    const sendQueued = this.meta.$sendQueued
    await this.meta.$app.execute(message, this.meta)
    this.meta.$sendQueued = sendQueued
    this.meta.$send = send
  }
}

export const name = 'eval'

export function apply (ctx: Context, config: Config = {}) {
  MainAPI.config = config = { ...defaultConfig, ...config }
  const resourceLimits = {
    ...defaultConfig.resourceLimits,
    ...config.resourceLimits,
  }

  let worker: Worker
  let remote: Remote<WorkerAPI>
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
    // TODO can it be on demand?
    .userFields(User.fields)
    .shortcut('>', { oneArg: true, fuzzy: true })
    .shortcut('>>', { oneArg: true, fuzzy: true, options: { output: true } })
    .option('-o, --output', '输出最后的结果')
    .option('-r, --restart', '重启子线程')
    .action(async ({ meta, options }, expression) => {
      if (options.restart) {
        await worker.terminate()
        return meta.$send('子线程已重启。')
      }

      if (!expression) return meta.$send('请输入要执行的脚本。')
      if (meta._eval) return meta.$send('不能嵌套调用本指令。')

      return new Promise((_resolve) => {
        defineProperty(meta, '_eval', true)

        const main = new MainAPI(meta)
        const timer = setTimeout(async () => {
          await worker.terminate()
          resolve()
          if (!main.logCount) {
            return meta.$send('执行超时。')
          }
        }, config.timeout)

        const listener = (error: Error) => {
          let message = ERROR_CODES[error['code']]
          if (!message) {
            logger.warn(error)
            message = '执行过程中遇到错误。'
          }
          resolve()
          return meta.$send(message)
        }
        worker.on('error', listener)

        remote.eval({
          meta: JSON.stringify(meta),
          user: JSON.stringify(meta.$user),
          output: options.output,
          source: CQCode.unescape(expression),
        }, proxy(main)).then(resolve)

        function resolve () {
          clearTimeout(timer)
          worker.off('error', listener)
          meta._eval = false
          _resolve()
        }
      })
    })
}

const ERROR_CODES = {
  ERR_WORKER_OUT_OF_MEMORY: '内存超出限制。',
}
