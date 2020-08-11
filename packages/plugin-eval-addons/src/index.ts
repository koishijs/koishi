import { Context, CommandAction } from 'koishi-core'
import { resolve } from 'path'
import {} from 'koishi-plugin-eval'
import { assertProperty, Logger, noop } from 'koishi-utils'
import { safeLoad } from 'js-yaml'
import { readdirSync, promises } from 'fs'

const logger = Logger.create('addon')

export interface Config {
  moduleRoot: string
}

declare module 'koishi-plugin-eval/dist/worker' {
  interface WorkerConfig extends Config {}
}

interface Command {
  name: string
  desc: string
  options: {
    name: string
    desc: string
  }[]
}

interface Manifest {
  version: number
  commands?: Command[]
}

export function apply (ctx: Context, config: Config) {
  const { evalConfig } = ctx.app
  Object.assign(evalConfig, config)
  const moduleRoot = assertProperty(evalConfig, 'moduleRoot')
  evalConfig.setupFiles['koishi/addons.ts'] = resolve(__dirname, 'worker.js')

  const addons = ctx.command('addons', '扩展功能')

  const root = resolve(process.cwd(), moduleRoot)
  evalConfig.addonNames = readdirSync(root).filter(name => !name.includes('.'))
  evalConfig.addonNames.map(path => loadManifest(path).then(() => {
    logger.debug('load manifest %c', path)
  }, noop))

  async function loadManifest (path: string) {
    const content = await promises.readFile(resolve(root, path, 'manifest.yml'), 'utf8')
    const { commands = [] } = safeLoad(content) as Manifest
    commands.forEach(({ name, desc, options }) => {
      const cmd = addons.subcommand(name, desc).action(addonAction)
      options.forEach(({ name, desc }) => {
        cmd.option(name, desc)
      })
    })
  }

  const addonAction: CommandAction = ({ session, command: { name }, options, rest }, ...args) => {
    return session.$eval(`require('koishi').executeCommand(${JSON.stringify({ name, args, options, rest })})`, true)
  }
}
