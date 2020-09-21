import { Context, CommandConfig, OptionConfig } from 'koishi-core'
import { assertProperty, Logger, noop } from 'koishi-utils'
import { resolve } from 'path'
import { safeLoad } from 'js-yaml'
import { promises as fs } from 'fs'
import { attachTraps, FieldOptions } from 'koishi-plugin-eval'
import Git, { CheckRepoActions } from 'simple-git'
import { AddonWorkerConfig } from './worker'

const logger = new Logger('addon')

export interface Config extends AddonMainConfig, AddonWorkerConfig {}

export interface AddonMainConfig {
  gitRemote?: string
  exclude?: RegExp
}

declare module 'koishi-plugin-eval/dist/main' {
  interface MainConfig extends AddonMainConfig {}
}

interface OptionManifest extends OptionConfig {
  name: string
  desc: string
}

interface CommandManifest extends CommandConfig, FieldOptions {
  name: string
  desc: string
  options?: OptionManifest[]
}

interface Manifest {
  version: number
  commands?: CommandManifest[]
}

export function apply(ctx: Context, config: Config) {
  const { worker } = ctx.app
  Object.assign(worker.config, config)
  const root = resolve(process.cwd(), assertProperty(worker.config, 'moduleRoot'))
  worker.config.moduleRoot = root
  worker.config.dataKeys.push('addonNames', 'moduleRoot')
  worker.config.setupFiles['koishi/addons.ts'] = resolve(__dirname, 'worker.js')

  const git = Git(root)

  const addon = ctx.command('addon', '扩展功能')
    .option('update', '-u  更新扩展模块', { authority: 3 })
    .action(async ({ options, session }) => {
      if (options.update) {
        const { files, summary } = await git.pull(worker.config.gitRemote)
        if (!files.length) return '所有模块均已是最新。'
        await session.$app.worker.restart()
        return `更新成功！(${summary.insertions}A ${summary.deletions}D ${summary.changes}M)`
      }
      return session.$execute('help addon')
    })

  ctx.on('before-connect', async () => {
    const isRepo = await git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT)
    if (!isRepo) throw new Error(`moduleRoot "${root}" is not git repository`)
  })

  let manifests: Record<string, Promise<Manifest>>
  const { exclude = /^(\..+|node_modules)$/ } = worker.config

  ctx.on('worker/start', async () => {
    const dirents = await fs.readdir(root, { withFileTypes: true })
    const paths = worker.config.addonNames = dirents
      .filter(dir => dir.isDirectory() && !exclude.test(dir.name))
      .map(dir => dir.name)
    // cmd.dispose() may affect addon.children, so here we make a slice
    addon.children.slice().forEach(cmd => cmd.dispose())
    manifests = Object.fromEntries(paths.map(path => [path, loadManifest(path).catch<null>(noop)]))
  })

  async function loadManifest(path: string) {
    const content = await fs.readFile(resolve(root, path, 'manifest.yml'), 'utf8')
    return safeLoad(content) as Manifest
  }

  ctx.on('worker/ready', (response) => {
    worker.config.addonNames.map(async (path) => {
      const manifest = await manifests[path]
      if (!manifest) return
      const { commands = [] } = manifest
      commands.forEach((config) => {
        const { name: rawName, desc, options = [] } = config
        const [name] = rawName.split(' ', 1)
        if (!response.commands.includes(name)) {
          return logger.warn('unregistered command manifest: %c', name)
        }

        const cmd = addon
          .subcommand(rawName, desc, config)
          .option('debug', '启用调试模式', { type: 'boolean', hidden: true })

        attachTraps(cmd, config, async ({ session, command, options, ctxOptions }, ...args) => {
          const { name } = command, { worker } = session.$app
          const result = await worker.remote.callAddon(ctxOptions, { name, args, options })
          return result
        })

        options.forEach((config) => {
          const { name, desc } = config
          cmd.option(name, desc, config)
        })
      })
    })
  })
}
