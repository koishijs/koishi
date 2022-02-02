import { resolve, extname, dirname, isAbsolute } from 'path'
import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { App, Dict, Logger, interpolate, Modules, unwrapExports, valueMap, isNullable } from 'koishi'
import * as yaml from 'js-yaml'

declare module 'koishi' {
  namespace Context {
    interface Services {
      loader: Loader
    }
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

let cwd = process.cwd()
const logger = new Logger('app')

const writableExts = ['.json', '.yml', '.yaml']
const supportedExts = ['.js', '.json', '.ts', '.coffee', '.yaml', '.yml']

const context = {
  env: process.env,
}

export class Loader {
  dirname: string
  filename: string
  extname: string
  app: App
  config: App.Config
  cache: Dict<string> = {}
  isWritable: boolean

  constructor() {
    const basename = 'koishi.config'
    if (process.env.KOISHI_CONFIG_FILE) {
      this.filename = resolve(cwd, process.env.KOISHI_CONFIG_FILE)
      this.extname = extname(this.filename)
      this.dirname = cwd = dirname(this.filename)
    } else {
      const files = readdirSync(cwd)
      this.extname = supportedExts.find(ext => files.includes(basename + ext))
      if (!this.extname) {
        throw new Error(`config file not found`)
      }
      this.dirname = cwd
      this.filename = cwd + '/' + basename + this.extname
    }
    this.isWritable = writableExts.includes(this.extname)
  }

  interpolate(source: any) {
    if (typeof source === 'string') {
      return interpolate(source, context, /\$\{\{(.+?)\}\}/g)
    } else if (!source || typeof source !== 'object') {
      return source
    } else if (Array.isArray(source)) {
      return source.map(item => this.interpolate(item))
    } else {
      return valueMap(source, item => this.interpolate(item))
    }
  }

  loadConfig(): App.Config {
    let config: App.Config
    if (['.yaml', '.yml'].includes(this.extname)) {
      config = yaml.load(readFileSync(this.filename, 'utf8')) as any
    } else if (['.json'].includes(this.extname)) {
      // we do not use require here because it will pollute require.cache
      config = JSON.parse(readFileSync(this.filename, 'utf8')) as any
    } else {
      const module = require(this.filename)
      config = module.default || module
    }

    let resolved = new App.Config(config)
    if (this.isWritable) {
      // schemastery may change original config
      // so we need to validate config twice
      resolved = new App.Config(this.interpolate(config))
    }

    this.config = config
    return resolved
  }

  writeConfig() {
    // prevent hot reload when it's being written
    if (this.app.watcher) this.app.watcher.suspend = true
    if (this.extname === '.json') {
      writeFileSync(this.filename, JSON.stringify(this.config, null, 2))
    } else {
      writeFileSync(this.filename, yaml.dump(this.config))
    }
  }

  resolvePlugin(name: string) {
    try {
      this.cache[name] ||= Modules.resolve(name)
    } catch (err) {
      logger.error(err.message)
      return
    }
    return unwrapExports(require(this.cache[name]))
  }

  unloadPlugin(name: string) {
    const plugin = this.resolvePlugin(name)
    if (!plugin) return

    const names = Object.keys(this.cache).filter((name) => {
      const plugin = this.resolvePlugin(name)
      const state = this.app.registry.get(plugin)
      return state?.using.every(key => this.app[key])
    })

    const state = this.app.dispose(plugin)
    if (state) logger.info(`dispose plugin %c`, name)

    for (const name of names) {
      this.diagnose(name)
    }
  }

  reloadPlugin(name: string) {
    const plugin = this.resolvePlugin(name)
    if (!plugin) return

    if (this.app.isActive) {
      this.app._tasks.flush().then(() => this.diagnose(name))
    }

    const state = this.app.dispose(plugin)
    const config = this.config.plugins[name]
    logger.info(`%s plugin %c`, state ? 'reload' : 'apply', name)
    this.app.validate(plugin, config)
    this.app.plugin(plugin, this.interpolate(config))
  }

  createApp() {
    const app = this.app = new App(this.config)
    if (this.isWritable) app.loader = this
    app.baseDir = this.dirname
    const { plugins } = this.config
    for (const name in plugins) {
      if (name.startsWith('~')) continue
      this.reloadPlugin(name)
    }
    return app
  }

  diagnose(name: string) {
    const plugin = this.resolvePlugin(name)
    const state = this.app.registry.get(plugin)
    if (!state) return

    let missing = state.using.filter(key => !this.app[key])
    if (!missing.length) return
    this.app.logger('diagnostic').warn('plugin %c is missing required service %c', name, missing.join(', '))
  }
}
