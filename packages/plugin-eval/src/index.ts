import { Context, Argv } from 'koishi-core'
import { segment, Logger, defineProperty } from 'koishi-utils'
import { Script } from 'vm'
import { EvalWorker, attachTraps, EvalConfig, Config, resolveAccess } from './main'

export * from './main'

declare module 'koishi-core/dist/app' {
  interface App {
    worker: EvalWorker
  }
}

declare module 'koishi-core/dist/command' {
  namespace Command {
    interface Config {
      noEval?: boolean
    }
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
  authority: 2,
  timeout: 1000,
  setupFiles: {},
  maxLogs: Infinity,
  channelFields: ['id'],
  userFields: ['id', 'authority'],
  dataKeys: ['inspect', 'setupFiles'],
}

const logger = new Logger('eval')

export const name = 'eval'

export function apply(ctx: Context, config: Config = {}) {
  const { prefix, authority } = config = { ...defaultConfig, ...config }
  const { app } = ctx
  const worker = new EvalWorker(app, config)
  defineProperty(app, 'worker', worker)

  app.before('connect', () => {
    return worker.start()
  })

  ctx.before('command', ({ command, session }) => {
    if (command.config.noEval && session._isEval) {
      return `不能在 evaluate 指令中调用 ${command.name} 指令。`
    }
  })

  const userAccess = resolveAccess(config.userFields)
  const groupAccess = resolveAccess(config.channelFields)

  const command = ctx.command('evaluate [expr...]', '执行 JavaScript 脚本', { noEval: true })
    .alias('eval')
    .userFields(['authority'])
    .option('slient', '-s  不输出最后的结果')
    .option('restart', '-r  重启子线程', { authority: 3 })
    .action(({ session }) => {
      if (!session['_redirected'] && session.$user?.authority < authority) return '权限不足。'
    })

  attachTraps(command, userAccess, groupAccess, async ({ session, options, ctxOptions }, expr) => {
    if (options.restart) {
      await app.worker.restart()
      return '子线程已重启。'
    }

    if (!expr) return '请输入要执行的脚本。'
    expr = segment.unescape(expr)

    try {
      Reflect.construct(Script, [expr, { filename: 'stdin' }])
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e
      const lines = e.stack.split('\n', 5)
      return `${lines[4]}\n    at ${lines[0]}:${lines[2].length}`
    }

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
    command.shortcut(prefix, { greedy: true, fuzzy: true })
    command.shortcut(prefix + prefix, { greedy: true, fuzzy: true, options: { slient: true } })
  }

  Argv.interpolate('${', '}', (source) => {
    const expr = segment.unescape(source)
    try {
      Reflect.construct(Script, [expr])
    } catch (e) {
      if (!(e instanceof Error)) throw e
      if (e.message === "Unexpected token '}'") {
        const eLines = e.stack.split('\n')
        const sLines = expr.split('\n')
        const cap = /\d+$/.exec(eLines[0])
        const row = +cap[0] - 1
        const rest = sLines[row].slice(eLines[2].length) + sLines.slice(row + 1)
        source = sLines.slice(0, row) + sLines[row].slice(0, eLines[2].length - 1)
        return { source, command, args: [source], rest: segment.escape(rest) }
      }
    }
    return { source, rest: source, tokens: [] }
  })
}

const ERROR_CODES = {
  ERR_WORKER_OUT_OF_MEMORY: '内存超出限制。',
}
