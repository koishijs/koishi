import { App, Context, User, Session } from 'koishi-core'
import { CQCode, Logger, defineProperty, omit, Random } from 'koishi-utils'
import { Worker, ResourceLimits } from 'worker_threads'
import { WorkerAPI, WorkerConfig, WorkerData } from './worker'
import { wrap, expose, Remote } from './transfer'
import { resolve } from 'path'

declare module 'koishi-core/dist/app' {
  interface App {
    _sessions: Record<string, Session>
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
    $uuid: string
    _isEval: boolean
    _logCount: number
  }
}

interface MainConfig {
  prefix?: string
  timeout?: number
  maxLogs?: number
  blacklist?: string[]
  resourceLimits?: ResourceLimits
}

interface EvalConfig extends MainConfig, WorkerData {}

export interface Config extends MainConfig, WorkerConfig {}

const defaultConfig: Config = {
  prefix: '>',
  timeout: 1000,
  setupFiles: {},
  blacklist: ['evaluate', 'echo', 'broadcast', 'teach', 'contextify'],
}

const logger = Logger.create('eval')

export class MainAPI {
  constructor(public app: App) {}

  async execute(uuid: string, message: string) {
    const session = this.app._sessions[uuid]
    if (!session) throw new Error('session not found')
    const send = session.$send
    const sendQueued = session.$sendQueued
    await session.$execute(message)
    session.$sendQueued = sendQueued
    session.$send = send
  }

  async send(uuid: string, message: string) {
    const session = this.app._sessions[uuid]
    if (!session) throw new Error('session not found')
    if (!session._logCount) session._logCount = 0
    if (this.app.evalConfig.maxLogs > session._logCount++) {
      return await session.$sendQueued(message)
    }
  }
}

export function apply(ctx: Context, config: Config = {}) {
  const { prefix } = config = { ...defaultConfig, ...config }
  const { app } = ctx
  defineProperty(app, '_sessions', {})
  defineProperty(app, 'evalConfig', config)
  defineProperty(app, 'evalRemote', null)
  defineProperty(app, 'evalWorker', null)

  let restart = true
  const api = new MainAPI(app)
  async function createWorker() {
    const worker = app.evalWorker = new Worker(resolve(__dirname, 'worker.js'), {
      workerData: {
        logLevels: Logger.levels,
        ...omit(config, ['maxLogs', 'resourceLimits', 'timeout', 'blacklist']),
      },
      resourceLimits: config.resourceLimits,
    })

    expose(worker, api)

    app.evalRemote = wrap(worker)
    app.evalRemote.start().then(() => {
      app.emit('worker/start')
      logger.info('worker started')

      worker.on('exit', (code) => {
        ctx.emit('worker/exit')
        logger.info('exited with code', code)
        if (restart) createWorker()
      })
    })
  }

  process.on('beforeExit', () => {
    restart = false
  })

  app.prependMiddleware((session, next) => {
    app._sessions[session.$uuid = Random.uuid()] = session
    return next()
  })

  app.on('after-middleware', (session) => {
    delete app._sessions[session.$uuid]
  })

  app.on('before-connect', () => {
    return createWorker()
  })

  const blacklist = [...defaultConfig.blacklist, ...config.blacklist]
  ctx.on('before-command', async ({ command, session }) => {
    if (blacklist.includes(command.name) && session._isEval) {
      return `不能在 evaluate 指令中调用 ${command.name} 指令。`
    }
  })

  const evaluate = ctx.command('evaluate [expr...]', '执行 JavaScript 脚本')
    .alias('eval')
    .userFields(User.fields)
    .option('slient', '-s  不输出最后的结果')
    .option('restart', '-r  重启子线程', { authority: 3 })
    .before((session) => {
      if (!session['_redirected'] && session.$user.authority < 2) return '权限不足。'
    })
    .action(async ({ session, options }, expr) => {
      if (options.restart) {
        await session.$app.evalWorker.terminate()
        return '子线程已重启。'
      }

      if (!expr) return '请输入要执行的脚本。'
      expr = CQCode.unescape(expr)

      return new Promise((resolve) => {
        logger.debug(expr)
        defineProperty(this, '_duringEval', true)

        const _resolve = (result?: string) => {
          clearTimeout(timer)
          app.evalWorker.off('error', listener)
          this._isEval = false
          resolve(result)
        }

        const timer = setTimeout(async () => {
          await app.evalWorker.terminate()
          _resolve(!this._logCount && '执行超时。')
        }, config.timeout)

        const listener = (error: Error) => {
          let message = ERROR_CODES[error['code']]
          if (!message) {
            logger.warn(error)
            message = '执行过程中遇到错误。'
          }
          _resolve(message)
        }

        app.evalWorker.on('error', listener)
        app.evalRemote.eval({
          sid: this.$uuid,
          user: this.$user,
          silent: options.slient,
          source: expr,
        }).then(_resolve, (error) => {
          logger.warn(error)
          _resolve()
        })
      })
    })

  if (prefix) {
    evaluate.shortcut(prefix, { oneArg: true, fuzzy: true })
    evaluate.shortcut(prefix + prefix, { oneArg: true, fuzzy: true, options: { slient: true } })
  }
}

const ERROR_CODES = {
  ERR_WORKER_OUT_OF_MEMORY: '内存超出限制。',
}
