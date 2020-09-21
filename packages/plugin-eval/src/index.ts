import { Context } from 'koishi-core'
import { CQCode, Logger, defineProperty } from 'koishi-utils'
import { EvalWorker, attachTraps, EvalConfig, Config } from './main'

export * from './main'

declare module 'koishi-core/dist/app' {
  interface App {
    worker: EvalWorker
  }
}

declare module 'koishi-core/dist/command' {
  interface CommandConfig {
    noEval?: boolean
  }
}

declare module 'koishi-core/dist/session' {
  interface Session {
    _isEval: boolean
    _sendCount: number
  }
}

const defaultConfig: EvalConfig = {
  prefix: '>',
  timeout: 1000,
  setupFiles: {},
  maxLogs: Infinity,
  groupFields: ['id'],
  userFields: ['id', 'authority'],
  dataKeys: ['inspect', 'setupFiles'],
}

const logger = new Logger('eval')

export const name = 'eval'

export function apply(ctx: Context, config: Config = {}) {
  const { prefix } = config = { ...defaultConfig, ...config }
  const { app } = ctx
  const worker = new EvalWorker(app, config)
  defineProperty(app, 'worker', worker)

  app.on('before-connect', () => {
    return worker.start()
  })

  ctx.on('before-command', ({ command, session }) => {
    if (command.config.noEval && session._isEval) {
      return `不能在 evaluate 指令中调用 ${command.name} 指令。`
    }
  })

  const cmd = ctx.command('evaluate [expr...]', '执行 JavaScript 脚本', { noEval: true })
    .alias('eval')
    .userFields(['authority'])
    .option('slient', '-s  不输出最后的结果')
    .option('restart', '-r  重启子线程', { authority: 3 })
    .before((session) => {
      if (!session['_redirected'] && session.$user?.authority < 2) return '权限不足。'
    })

  attachTraps(cmd, config, async ({ session, options, ctxOptions }, expr) => {
    if (options.restart) {
      await app.worker.restart()
      return '子线程已重启。'
    }

    if (!expr) return '请输入要执行的脚本。'
    expr = CQCode.unescape(expr)

    return await new Promise((resolve) => {
      logger.debug(expr)
      defineProperty(session, '_isEval', true)

      const _resolve = (result?: string) => {
        clearTimeout(timer)
        session._isEval = false
        dispose()
        resolve(result)
      }

      const timer = setTimeout(async () => {
        _resolve(!session._sendCount && '执行超时。')
        app.worker.restart()
      }, config.timeout)

      const dispose = app.worker.onError((error: Error) => {
        let message = ERROR_CODES[error['code']]
        if (!message) {
          logger.warn(error)
          message = '执行过程中遇到错误。'
        }
        _resolve(message)
      })

      app.worker.remote.eval(ctxOptions, {
        silent: options.slient,
        source: expr,
      }).then(_resolve, (error) => {
        logger.warn(error)
        _resolve()
      })
    })
  })

  if (prefix) {
    cmd.shortcut(prefix, { oneArg: true, fuzzy: true })
    cmd.shortcut(prefix + prefix, { oneArg: true, fuzzy: true, options: { slient: true } })
  }
}

const ERROR_CODES = {
  ERR_WORKER_OUT_OF_MEMORY: '内存超出限制。',
}
