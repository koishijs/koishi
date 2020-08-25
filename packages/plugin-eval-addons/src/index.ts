import { Context, CommandConfig, OptionConfig, User } from 'koishi-core'
import { resolve } from 'path'
import {} from 'koishi-plugin-eval'
import { assertProperty, Logger, noop } from 'koishi-utils'
import { safeLoad } from 'js-yaml'
import { promises } from 'fs'
import Git, { CheckRepoActions } from 'simple-git'

const logger = new Logger('addon')

export interface Config {
  gitRemote?: string
  moduleRoot?: string
  exclude?: RegExp
}

interface OptionManifest extends OptionConfig {
  name: string
  desc: string
}

type Permission<T> = T[] | {
  read?: T[]
  write?: T[]
}

interface CommandManifest extends CommandConfig {
  name: string
  desc: string
  options?: OptionManifest[]
  userFields?: Permission<User.Field>
}

interface Manifest {
  version: number
  commands?: CommandManifest[]
}

export function apply(ctx: Context, config: Config) {
  const { evalConfig } = ctx.app
  Object.assign(evalConfig, config)
  const moduleRoot = assertProperty(evalConfig, 'moduleRoot')
  evalConfig.setupFiles['koishi/addons.ts'] = resolve(__dirname, 'worker.js')

  const root = resolve(process.cwd(), moduleRoot)
  const git = Git(root)

  const addon = ctx.command('addon', '扩展功能')
    .option('update', '-u  更新扩展模块', { authority: 3 })
    .action(async ({ options, session }) => {
      if (options.update) {
        const { files, summary } = await git.pull(evalConfig.gitRemote)
        if (!files.length) return '所有模块均已是最新。'
        await session.$app.evalWorker.terminate()
        return `更新成功！(${summary.insertions}A ${summary.deletions}D ${summary.changes}M)`
      }
      return session.$execute('help addon')
    })

  ctx.on('before-connect', async () => {
    const isRepo = await git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT)
    if (!isRepo) throw new Error(`moduleRoot "${moduleRoot}" is not git repository`)
  })

  const { exclude = /^(\..+|node_modules)$/ } = evalConfig
  ctx.on('worker/start', async () => {
    const dirents = await promises.readdir(root, { withFileTypes: true })
    evalConfig.addonNames = dirents
      .filter(dir => dir.isDirectory() && !exclude.test(dir.name))
      .map(dir => dir.name)
    // cmd.dispose() may affect addon.children, so here we make a slice
    addon.children.slice().forEach(cmd => cmd.dispose())
  })

  ctx.on('worker/ready', (response) => {
    evalConfig.addonNames.map(async (path) => {
      const content = await promises.readFile(resolve(root, path, 'manifest.yml'), 'utf8').catch<string>(noop)
      if (!content) return
      const { commands = [] } = safeLoad(content) as Manifest
      commands.forEach((config) => {
        const { name: rawName, desc, options = [], userFields = [] } = config
        const [name] = rawName.split(' ', 1)
        if (!response.commands.includes(name)) {
          return logger.warn('unregistered command manifest: %c', name)
        }
        const { read = [] } = Array.isArray(userFields) ? { read: userFields } : userFields
        const cmd = addon
          .subcommand(rawName, desc, config)
          .userFields(read)
          .action(async ({ session, command: { name }, options }, ...args) => {
            const { $app, $user, $uuid } = session
            const result = await $app.evalRemote.addon($uuid, $user, { name, args, options })
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
