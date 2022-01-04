import { resolve, extname, dirname, isAbsolute } from 'path'
import { yellow } from 'kleur'
import { readdirSync, readFileSync } from 'fs'
import { App, defineProperty, Dict, Logger, Modules, Plugin, Schema } from 'koishi'
import { load } from 'js-yaml'

declare module 'koishi' {
  interface App {
    loader: Loader
  }
}

const oldPaths = Modules.internal.paths
Modules.internal.paths = function (name: string) {
  // resolve absolute or relative path
  if (isAbsolute(name) || name.startsWith('.')) {
    return [resolve(cwd, name)]
  }
  return oldPaths(name)
}

App.Config.list.push(Schema.object({
  allowWrite: Schema.boolean().description('允许插件修改本地配置文件。'),
  autoRestart: Schema.boolean().description('应用在运行时崩溃自动重启。').default(true),
  plugins: Schema.any().hidden(),
}).description('CLI 设置'))

let cwd = process.cwd()
const logger = new Logger('app')

export class Loader {
  dirname: string
  filename: string
  extname: string
  app: App
  cache: Dict<Plugin> = {}

  constructor() {
    const basename = 'koishi.config'
    if (process.env.KOISHI_CONFIG_FILE) {
      this.filename = resolve(cwd, process.env.KOISHI_CONFIG_FILE)
      this.extname = extname(this.filename)
      this.dirname = cwd = dirname(this.filename)
    } else {
      const files = readdirSync(cwd)
      this.extname = ['.js', '.json', '.ts', '.coffee', '.yaml', '.yml'].find(ext => files.includes(basename + ext))
      if (!this.extname) {
        throw new Error(`config file not found. use ${yellow('koishi init')} command to initialize a config file.`)
      }
      this.dirname = cwd
      this.filename = cwd + '/' + basename + this.extname
    }
  }

  loadConfig(): App.Config {
    if (['.yaml', '.yml'].includes(this.extname)) {
      return load(readFileSync(this.filename, 'utf8')) as any
    } else {
      const module = require(this.filename)
      return module.default || module
    }
  }

  resolvePlugin(name: string) {
    return this.cache[name] = Modules.require(name, true)
  }

  loadPlugin(name: string, options?: any) {
    const plugin = this.resolvePlugin(name)
    if (this.app.registry.has(plugin)) return plugin
    this.app.plugin(plugin, options)
    return plugin
  }

  createApp(config: App.Config) {
    defineProperty(config, 'baseDir', this.dirname)
    const app = this.app = new App(config)
    const plugins = app.options.plugins ||= {}
    for (const name in plugins) {
      if (name.startsWith('~')) {
        this.resolvePlugin(name.slice(1))
      } else {
        logger.info(`apply plugin %c`, name)
        this.loadPlugin(name, plugins[name] ?? {})
      }
    }
    app.loader = this
    return app
  }
}
