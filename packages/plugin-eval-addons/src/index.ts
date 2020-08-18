import { Context, CommandAction, CommandConfig, OptionConfig } from 'koishi-core'
import { resolve } from 'path'
import {} from 'koishi-plugin-eval'
import { assertProperty, Logger, noop } from 'koishi-utils'
import { safeLoad } from 'js-yaml'
import { readdirSync, promises } from 'fs'
import Git, { CheckRepoActions } from 'simple-git'

const logger = Logger.create('addon')

export interface Config {
  gitRemote?: string
  moduleRoot?: string
}

declare module 'koishi-plugin-eval/dist/worker' {
  interface WorkerConfig extends Config {}
}

interface Option extends OptionConfig {
  name: string
  desc: string
}

interface Command extends CommandConfig {
  name: string
  desc: string
  options?: Option[]
}

interface Manifest {
  version: number
  commands?: Command[]
}

export function apply(ctx: Context, config: Config) {
  const { evalConfig } = ctx.app
  Object.assign(evalConfig, config)
  const moduleRoot = assertProperty(evalConfig, 'moduleRoot')
  evalConfig.setupFiles['koishi/addons.ts'] = resolve(__dirname, 'worker.js')

  const addon = ctx.command('addon', '扩展功能')

  const root = resolve(process.cwd(), moduleRoot)
  evalConfig.addonNames = readdirSync(root).filter(name => !name.includes('.'))
  evalConfig.addonNames.map(path => loadManifest(path).then(() => {
    logger.debug('load manifest %c', path)
  }, noop))

  async function loadManifest(path: string) {
    const content = await promises.readFile(resolve(root, path, 'manifest.yml'), 'utf8')
    const { commands = [] } = safeLoad(content) as Manifest
    commands.forEach((config) => {
      const { name, desc, options } = config
      const cmd = addon.subcommand(name, desc, config).action(addonAction)
      options.forEach((config) => {
        const { name, desc } = config
        cmd.option(name, desc, config)
      })
    })
  }

  const git = Git(root)
  ctx.on('before-connect', async () => {
    const isRepo = await git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT)
    if (!isRepo) {
      return logger.warn(`moduleRoot "${moduleRoot}" is not git repository`)
    }

    addon.subcommand('.update', '更新扩展模块', { authority: 3 })
      .action(async () => {
        const { files, summary } = await git.pull(evalConfig.gitRemote)
        if (!files.length) return '所有模块均已是最新。'
        return `更新成功！\n${summary.insertions}A ${summary.deletions}D ${summary.changes}M`
      })
  })

  const addonAction: CommandAction = ({ session, command: { name }, options, rest }, ...args) => {
    return session.$app.evalRemote.addon(session.$uuid, session.$user, { name, args, options, rest })
  }
}
