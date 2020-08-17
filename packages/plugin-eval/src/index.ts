import { Context, User, Session } from 'koishi-core'
import { CQCode, Logger, defineProperty, omit } from 'koishi-utils'
import { Worker, ResourceLimits } from 'worker_threads'
import { wrap, Remote, proxy } from './comlink'
import { WorkerAPI, WorkerConfig, WorkerData } from './worker'
import { resolve } from 'path'

declare module 'koishi-core/dist/app' {
  interface App {
    evalConfig: EvalConfig
    evalWorker: Worker
    evalRemote: Remote<WorkerAPI>
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
    $eval(source: string, output?: boolean): Promise<string>
  }
}

interface MainConfig {
  timeout?: number
  maxLogs?: number
  resourceLimits?: ResourceLimits
}

interface EvalConfig extends MainConfig, WorkerData {}

export interface Config extends MainConfig, WorkerConfig {}

const defaultConfig: Config = {
  timeout: 1000,
  maxLogs: 10,
  setupFiles: {},
  resourceLimits: {
    maxOldGenerationSizeMb: 64,
    maxYoungGenerationSizeMb: 64,
  },
}

const logger = Logger.create('eval')

export class MainAPI {
  static config: Config

  public logCount = 0

  constructor(private session: Session) {}

  send(message: string) {
    if (MainAPI.config.maxLogs > this.logCount++) {
      return this.session.$sendQueued(message)
    }
  }

  async execute(message: string) {
    const send = this.session.$send
    const sendQueued = this.session.$sendQueued
    await this.session.$execute(message)
    this.session.$sendQueued = sendQueued
    this.session.$send = send
  }
}

Session.prototype.$eval = function $eval(this: Session, source, output) {
  const { evalRemote, evalWorker, evalConfig } = this.$app

  return new Promise((resolve) => {
    logger.debug(source)
    const api = new MainAPI(this)
    defineProperty(this, '_eval', true)

    const _resolve = (result?: string) => {
      clearTimeout(timer)
      evalWorker.off('error', listener)
      this._eval = false
      resolve(result)
    }

    const timer = setTimeout(async () => {
      await evalWorker.terminate()
      _resolve(!api.logCount && '执行超时。')
    }, evalConfig.timeout)

    const listener = (error: Error) => {
      let message = ERROR_CODES[error['code']]
      if (!message) {
        logger.warn(error)
        message = '执行过程中遇到错误。'
      }
      _resolve(message)
    }

    evalWorker.on('error', listener)
    evalRemote.eval({
      session: JSON.stringify(this),
      user: JSON.stringify(this.$user),
      output,
      source,
    }, proxy(api)).then(_resolve, (error) => {
      logger.warn(error)
      _resolve()
    })
  })
}

export function apply(ctx: Context, config: Config = {}) {
  MainAPI.config = config = { ...defaultConfig, ...config }
  const resourceLimits = {
    ...defaultConfig.resourceLimits,
    ...config.resourceLimits,
  }

  defineProperty(ctx.app, 'evalConfig', config)
  defineProperty(ctx.app, 'evalRemote', null)
  defineProperty(ctx.app, 'evalWorker', null)

  let restart = false
  async function createWorker() {
    ctx.app.evalWorker = new Worker(resolve(__dirname, 'worker.js'), {
      workerData: {
        logLevels: Logger.levels,
        ...omit(config, ['maxLogs', 'resourceLimits', 'timeout']),
      },
      resourceLimits,
    })

    ctx.app.evalRemote = wrap(ctx.app.evalWorker)
    ctx.emit('worker/start')
    logger.info('worker started')

    ctx.app.evalRemote.start().then(() => {
      ctx.app.evalWorker.on('exit', (code) => {
        ctx.emit('worker/exit')
        logger.info('exited with code', code)
        if (restart) createWorker()
      })
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
        await session.$app.evalWorker.terminate()
        return '子线程已重启。'
      }

      if (!expr) return '请输入要执行的脚本。'
      if (session._eval) return '不能嵌套调用本指令。'
      return session.$eval(CQCode.unescape(expr), options.output)
    })
}

const ERROR_CODES = {
  ERR_WORKER_OUT_OF_MEMORY: '内存超出限制。',
}
