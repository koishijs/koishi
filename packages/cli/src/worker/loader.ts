import { resolve } from 'path'
import { App, Context, defineProperty, Dict, interpolate, Logger, Plugin, Registry, valueMap } from 'koishi'
import ConfigLoader from '@koishijs/loader'
import * as dotenv from 'dotenv'
import ns from 'ns-require'

declare module 'koishi' {
  namespace Context {
    interface Services {
      loader: Loader
    }
  }

  namespace Plugin {
    interface Runtime {
      [Loader.kRecord]?: Dict<Plugin.Fork>
    }
  }
}

Context.service('loader')

const logger = new Logger('app')

const context = {
  env: process.env,
}

export default class Loader extends ConfigLoader<App.Config> {
  static readonly kRecord = Symbol('record')

  app: App
  config: App.Config
  cache: Dict<string> = {}
  envfile: string
  scope: ns.Scope

  constructor() {
    super(process.env.KOISHI_CONFIG_FILE)
    this.envfile = resolve(this.dirname, '.env')
    this.scope = ns({
      namespace: 'koishi',
      prefix: 'plugin',
      official: 'koishijs',
      dirname: this.dirname,
    })
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

  readConfig() {
    // load .env file into process.env
    dotenv.config({ path: this.envfile })

    // load original config file
    const config = super.readConfig()

    let resolved = new App.Config(config)
    if (this.writable) {
      // schemastery may change original config
      // so we need to validate config twice
      resolved = new App.Config(this.interpolate(config))
    }

    return resolved
  }

  writeConfig() {
    // prevent hot reload when it's being written
    if (this.app.watcher) this.app.watcher.suspend = true
    super.writeConfig()
  }

  resolvePlugin(name: string) {
    try {
      this.cache[name] ||= this.scope.resolve(name)
    } catch (err) {
      logger.error(err.message)
      return
    }
    return ns.unwrapExports(require(this.cache[name]))
  }

  unloadPlugin(name: string) {
    const plugin = this.resolvePlugin(name)
    if (!plugin) return

    const names = Object.keys(this.cache).filter((name) => {
      const plugin = this.resolvePlugin(name)
      const runtime = this.app.registry.get(plugin)
      return runtime?.using.every(key => this.app[key])
    })

    const state = this.app.dispose(plugin)
    if (state) logger.info(`dispose plugin %c`, name)

    for (const name of names) {
      this.diagnose(name)
    }
  }

  loadPlugin(name: string, config: any, parent: Context, action = 'apply') {
    const plugin = this.resolvePlugin(name)
    if (!plugin) return

    if (this.app.lifecycle.isActive) {
      this.app.lifecycle.flush().then(() => this.diagnose(name))
    }

    logger.info(`%s plugin %c`, action, name)
    Registry.validate(plugin, config)
    return parent.plugin(plugin, this.interpolate(config))
  }

  loadGroup(name: string, plugins: Dict, root: Plugin.Runtime) {
    logger.info(`%s group %c`, 'load', name.slice(1))
    const { context, [Loader.kRecord]: record } = root
    const fork = record[name] = context.plugin(() => {})
    defineProperty(fork.runtime.plugin, 'name', name.slice(1))
    this.loadGroupRecord(plugins, fork.runtime)
  }

  private loadGroupRecord(plugins: Dict, root: Plugin.Runtime) {
    root[Loader.kRecord] = {}
    const { context, [Loader.kRecord]: record } = root
    for (const name in plugins || {}) {
      if (name.startsWith('~') || name.startsWith('$')) continue
      if (name.startsWith('+')) {
        this.loadGroup(name, plugins[name], root)
      } else {
        record[name] = this.loadPlugin(name, plugins[name], context)
      }
    }
  }

  createApp() {
    const app = this.app = new App(this.config)
    app.loader = this
    app.baseDir = this.dirname
    this.loadGroupRecord(this.config.plugins, app.state.runtime)
    return app
  }

  diagnose(name: string) {
    const plugin = this.resolvePlugin(name)
    const state = this.app.registry.get(plugin)
    if (!state) return

    const missing = state.using.filter(key => !this.app[key])
    if (!missing.length) return
    this.app.logger('diagnostic').warn('plugin %c is missing required service %c', name, missing.join(', '))
  }

  fullReload(): never {
    logger.info('trigger full reload')
    process.exit(51)
  }
}
