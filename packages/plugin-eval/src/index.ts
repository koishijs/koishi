import { Domain, Context, Command, Argv } from 'koishi-core'
import { segment, Logger, defineProperty, noop } from 'koishi-utils'
import { Script } from 'vm'
import { EvalWorker, Trap, EvalConfig, Config } from './main'
import { resolve } from 'path'
import { load } from 'js-yaml'
import { promises as fs } from 'fs'
import Git, { CheckRepoActions } from 'simple-git'
import { WorkerResponse } from './worker'

export * from './main'

declare module 'koishi-core' {
  interface App {
    worker: EvalWorker
  }

  namespace Command {
    interface Config {
      noEval?: boolean
    }
  }

  interface Session {
    _isEval: boolean
    _sendCount: number
  }
}

interface OptionManifest extends Domain.OptionConfig {
  name: string
  desc: string
}

interface CommandManifest extends Command.Config, Trap.Config {
  name: string
  desc: string
  options?: OptionManifest[]
}

interface Manifest {
  version: number
  commands?: CommandManifest[]
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
export const disposable = true

export function apply(ctx: Context, config: Config = {}) {
  const { prefix, authority } = config = { ...defaultConfig, ...config }
  const { app } = ctx

  // addons are registered in another plugin
  if (config.moduleRoot) {
    ctx.plugin(addon, config)
  }

  ctx.on('connect', () => {
    app.worker = new EvalWorker(app, config)
    app.worker.start()
  })

  ctx.before('disconnect', () => {
    return app.worker?.stop()
  })

  ctx.before('command', ({ command, session }) => {
    if (command.config.noEval && session._isEval) {
      return `不能在 evaluate 指令中调用 ${command.name} 指令。`
    }
  })

  const userAccess = Trap.resolve(config.userFields)
  const channelAccess = Trap.resolve(config.channelFields)

  // worker should be running for all the features
  ctx = ctx.intersect(sess => sess.app.worker?.state === EvalWorker.State.open)

  const command = ctx.command('evaluate [expr:text]', '执行 JavaScript 脚本', { noEval: true })
    .alias('eval')
    .userFields(['authority'])
    .option('slient', '-s  不输出最后的结果')
    .option('restart', '-r  重启子线程', { authority: 3 })
    .action(({ session }) => {
      if (!session['_redirected'] && session.user?.authority < authority) return '权限不足。'
    })

  Trap.action(command, userAccess, channelAccess, async ({ session, options, scope }, expr) => {
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

      app.worker.remote.eval(scope, {
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
    command.shortcut(prefix + prefix[prefix.length - 1], { greedy: true, fuzzy: true, options: { slient: true } })
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

function addon(ctx: Context, config: EvalConfig) {
  const root = config.moduleRoot = resolve(process.cwd(), config.moduleRoot)
  config.dataKeys.push('addonNames', 'moduleRoot')

  const git = Git(root)

  const addon = ctx.command('addon', '扩展功能')
    .option('update', '-u  更新扩展模块', { authority: 3 })
    .action(async ({ options, session }) => {
      if (options.update) {
        const { files, summary } = await git.pull(ctx.app.worker.config.gitRemote)
        if (!files.length) return '所有模块均已是最新。'
        await ctx.app.worker.restart()
        return `更新成功！(${summary.insertions}A ${summary.deletions}D ${summary.changes}M)`
      }
      return session.execute('help addon')
    })

  // we only check it once
  ctx.before('connect', async () => {
    const isRepo = await git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT)
    if (!isRepo) throw new Error(`moduleRoot "${root}" is not git repository`)
  })

  let manifests: Record<string, Promise<Manifest>>
  const { exclude = /^(\..+|node_modules)$/ } = config
  const userBaseAccess = Trap.resolve(config.userFields)
  const channelBaseAccess = Trap.resolve(config.channelFields)

  async function loadManifest(path: string) {
    const content = await fs.readFile(resolve(root, path, 'manifest.yml'), 'utf8')
    return load(content) as Manifest
  }

  ctx.on('worker/start', async () => {
    const dirents = await fs.readdir(root, { withFileTypes: true })
    const paths = config.addonNames = dirents
      .filter(dir => dir.isDirectory() && !exclude.test(dir.name))
      .map(dir => dir.name)
    // cmd.dispose() may affect addon.children, so here we make a slice
    addon.children.slice().forEach(cmd => cmd.dispose())
    manifests = Object.fromEntries(paths.map(path => [path, loadManifest(path).catch<null>(noop)]))
  })

  async function registerAddon(data: WorkerResponse, path: string) {
    const manifest = await manifests[path]
    if (!manifest) return

    const { commands = [] } = manifest
    commands.forEach((config) => {
      const { name: rawName, desc, options = [] } = config
      const [name] = rawName.split(' ', 1)
      if (!data.commands.includes(name)) {
        return logger.warn('unregistered command manifest: %c', name)
      }

      const userAccess = Trap.merge(userBaseAccess, config.userFields)
      const channelAccess = Trap.merge(channelBaseAccess, config.channelFields)

      const cmd = addon
        .subcommand(rawName, desc, config)
        .option('debug', '启用调试模式', { hidden: true })

      Trap.action(cmd, userAccess, channelAccess, async ({ session, command, options, scope }, ...args) => {
        const { name } = command, { remote } = session.app.worker
        const result = await remote.callAddon(scope, { name, args, options })
        return result
      })

      options.forEach((config) => {
        const { name, desc } = config
        cmd.option(name, desc, config)
      })
    })
  }

  ctx.on('worker/ready', (data) => {
    config.addonNames.map((path) => {
      registerAddon(data, path)
    })
  })
}

const ERROR_CODES = {
  ERR_WORKER_OUT_OF_MEMORY: '内存超出限制。',
}
