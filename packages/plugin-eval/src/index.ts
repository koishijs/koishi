import { Context, User, Session } from 'koishi-core'
import { CQCode, Logger, defineProperty, omit } from 'koishi-utils'
import { Worker, ResourceLimits } from 'worker_threads'
import { wrap, Remote, proxy, pend } from './comlink'
import { WorkerAPI, WorkerConfig } from './worker'
import { resolve } from 'path'

declare module 'koishi-core/dist/app' {
  interface App {
    evalConfig: Config
  }
}

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'worker/start' (): void
    'worker/exit' (): void
  }
}

declare module 'koishi-core/dist/session' {
  interface Session {
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
  setupFiles: [],
  resourceLimits: {
    maxOldGenerationSizeMb: 64,
    maxYoungGenerationSizeMb: 64,
  },
}

const logger = Logger.create('eval')

export class MainAPI {
  static config: Config

  public logCount = 0

  constructor (private session: Session) {}

  send (message: string) {
    if (MainAPI.config.maxLogs > this.logCount++) {
      return this.session.$sendQueued(message)
    }
  }

  async execute (message: string) {
    const send = this.session.$send
    const sendQueued = this.session.$sendQueued
    await this.session.$execute(message)
    this.session.$sendQueued = sendQueued
    this.session.$send = send
  }
}

export const name = 'eval'

export function apply (ctx: Context, config: Config = {}) {
  MainAPI.config = config = { ...defaultConfig, ...config }
  const resourceLimits = {
    ...defaultConfig.resourceLimits,
    ...config.resourceLimits,
  }

  defineProperty(ctx.app, 'evalConfig', config)

  let restart = true
  let worker: Worker
  let remote: Remote<WorkerAPI>
  async function createWorker () {
    worker = new Worker(resolve(__dirname, 'worker.js'), {
      workerData: {
        logLevels: Logger.levels,
        ...omit(config, ['maxLogs', 'resourceLimits', 'timeout'])
      },
      resourceLimits,
    })

    await pend(worker)
    remote = wrap(worker)
    ctx.emit('worker/start')
    logger.info('worker started')

    worker.on('exit', (code) => {
      ctx.emit('worker/exit')
      logger.info('exited with code', code)
      if (restart) createWorker()
    })
  }

  process.on('beforeExit', () => {
    restart = false
  })

  ctx.on('before-connect', () => {
    return createWorker()
  })

  ctx.command('eval [expr...]', '执行 JavaScript 脚本', { authority: 2 })
    // TODO can it be on demand?
    .userFields(User.fields)
    .shortcut('>', { oneArg: true, fuzzy: true })
    .shortcut('>>', { oneArg: true, fuzzy: true, options: { output: true } })
    .option('output', '-o  输出最后的结果')
    .option('restart', '-r  重启子线程', { authority: 3 })
    .action(async ({ session, options }, expr) => {
      if (options.restart) {
        await worker.terminate()
        return '子线程已重启。'
      }

      if (!expr) return '请输入要执行的脚本。'
      if (session._eval) return '不能嵌套调用本指令。'

      expr = CQCode.unescape(expr)
      return new Promise((resolve) => {
        logger.debug(expr)
        defineProperty(session, '_eval', true)

        const main = new MainAPI(session)
        const timer = setTimeout(async () => {
          await worker.terminate()
          _resolve()
          if (!main.logCount) {
            return session.$send('执行超时。')
          }
        }, config.timeout)

        const listener = (error: Error) => {
          let message = ERROR_CODES[error['code']]
          if (!message) {
            logger.warn(error)
            message = '执行过程中遇到错误。'
          }
          _resolve()
          return session.$send(message)
        }
        worker.on('error', listener)

        remote.eval({
          session: JSON.stringify(session),
          user: JSON.stringify(session.$user),
          output: options.output,
          source: expr,
        }, proxy(main)).then(_resolve, (error) => {
          logger.warn(error)
          _resolve()
        })

        function _resolve () {
          clearTimeout(timer)
          worker.off('error', listener)
          session._eval = false
          resolve()
        }
      })
    })
}

const ERROR_CODES = {
  ERR_WORKER_OUT_OF_MEMORY: '内存超出限制。',
}
