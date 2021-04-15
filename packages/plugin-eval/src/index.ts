import { Domain, Context, Command, Argv } from 'koishi-core'
import { segment, Logger, defineProperty, noop } from 'koishi-utils'
import { EvalWorker, Trap, EvalConfig, Config } from './main'
import { resolve } from 'path'
import { load } from 'js-yaml'
import { promises as fs } from 'fs'
import Git, { CheckRepoActions } from 'simple-git'
import { WorkerResponse, Loader } from './worker'

export * from './main'

declare module 'koishi-core' {
  interface Context {
    worker: EvalWorker
  }

  namespace Command {
    interface Config {
      noEval?: boolean
    }
  }

  interface Session {
    _isEval: boolean
  }

  namespace Plugin {
    interface Packages {
      'koishi-plugin-eval': typeof import('.')
    }
  }

  interface EventMap {
    'eval/before-send'(content: string, session: Session): string | Promise<string>
    'eval/before-start'(): void | Promise<void>
    'eval/start'(response: WorkerResponse): void
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
  moduleLoaders: {},
  scriptLoader: 'default',
  channelFields: ['id'],
  userFields: ['id', 'authority'],
  dataKeys: ['inspect', 'moduleLoaders', 'setupFiles'],
}

declare const BUILTIN_LOADERS: string[]

const logger = new Logger('eval')

export const name = 'eval'

Context.delegate('worker')

export function apply(ctx: Context, config: Config = {}) {
  const { prefix, authority } = config = { ...defaultConfig, ...config }

  ctx.worker = new EvalWorker(ctx, config)

  // resolve loader filepath
  if (BUILTIN_LOADERS.includes(config.scriptLoader)) {
    config.scriptLoader = resolve(__dirname, 'loaders', config.scriptLoader)
  } else {
    config.scriptLoader = resolve(process.cwd(), config.scriptLoader)
  }
  const loader = require(config.scriptLoader) as Loader

  // addons are registered in another plugin
  if (config.root) ctx.plugin(addon, config)

  ctx.before('command', ({ command, session }) => {
    if (command.config.noEval && session._isEval) {
      return `不能在 evaluate 指令中调用 ${command.name} 指令。`
    }
  })

  const userAccess = Trap.resolve(config.userFields)
  const channelAccess = Trap.resolve(config.channelFields)

  // worker should be running for all the features
  ctx = ctx.intersect(() => ctx.worker?.state === EvalWorker.State.open)

  const command = ctx.command('evaluate [expr:text]', '执行 JavaScript 脚本', { noEval: true })
    .alias('eval')
    .userFields(['authority'])
    .option('slient', '-s  不输出最后的结果')
    .option('restart', '-r  重启子线程', { authority: 3 })
    .check(({ session }) => {
      if (!session['_redirected'] && session.user?.authority < authority) return '权限不足。'
    })
    .action(async ({ options }) => {
      if (options.restart) {
        await ctx.worker.restart()
        return '子线程已重启。'
      }
    })

  Trap.action(command, userAccess, channelAccess, async ({ session, options, payload }, expr) => {
    if (!expr) return '请输入要执行的脚本。'

    try {
      expr = await loader.transformScript(segment.unescape(expr))
    } catch (err) {
      return err.message
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
        await ctx.worker.restart()
        _resolve('执行超时。')
      }, config.timeout)

      const dispose = ctx.worker.onError((error: Error) => {
        let message = ERROR_CODES[error['code']]
        if (!message) {
          logger.warn(error)
          message = '执行过程中遇到错误。'
        }
        _resolve(message)
      })

      ctx.worker.remote.eval(payload, {
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
    const result = loader.extractScript(segment.unescape(source))
    if (!result) {
      const index = source.indexOf('}')
      if (index >= 0) return { source, rest: source.slice(index + 1), tokens: [] }
      return { source, rest: '', tokens: [] }
    }
    return {
      source,
      command,
      args: [result],
      rest: segment.escape(source.slice(result.length + 1)),
    }
  })
}

function addon(ctx: Context, config: EvalConfig) {
  const logger = ctx.logger('eval:addons')
  const root = config.root = resolve(process.cwd(), config.root)
  config.dataKeys.push('addonNames', 'root')

  const git = Git(root)

  const addon = ctx.command('addon', '扩展功能')
    .action(async ({ session }) => {
      await session.execute('help addon')
    })

  ctx.on('connect', async () => {
    const isRepo = await git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT)
    if (!isRepo) return
    addon
      .option('update', '-u  更新扩展模块', { authority: 3 })
      .action(async ({ options }) => {
        if (!options.update) return
        const { files, summary } = await git.pull(ctx.worker.config.gitRemote)
        if (!files.length) return '所有模块均已是最新。'
        await ctx.worker.restart()
        return `更新成功！(${summary.insertions}A ${summary.deletions}D ${summary.changes}M)`
      })
  })

  let manifests: Record<string, Promise<Manifest>>
  const { exclude = /^(\..+|node_modules)$/ } = config
  const userBaseAccess = Trap.resolve(config.userFields)
  const channelBaseAccess = Trap.resolve(config.channelFields)

  async function loadManifest(path: string) {
    const content = await fs.readFile(resolve(root, path, 'manifest.yml'), 'utf8')
    return load(content) as Manifest
  }

  ctx.before('eval/start', async () => {
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

      Trap.action(cmd, userAccess, channelAccess, async ({ command, options, payload }, ...args) => {
        const { name } = command
        return ctx.worker.remote.callAddon(payload, { name, args, options })
      })

      options.forEach((config) => {
        const { name, desc } = config
        cmd.option(name, desc, config)
      })
    })
  }

  ctx.on('eval/start', (data) => {
    config.addonNames.map((path) => {
      registerAddon(data, path)
    })
  })
}

const ERROR_CODES = {
  ERR_WORKER_OUT_OF_MEMORY: '内存超出限制。',
}
