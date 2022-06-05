import { resolve } from 'path'
import { App, Context, Dict, interpolate, Logger, Plugin, Registry, valueMap } from 'koishi'
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
      [Loader.kWarning]?: boolean
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
  static readonly kWarning = Symbol('warning')

  app: App
  config: App.Config
  runtime: Plugin.Runtime
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

  loadPlugin(name: string, config: any, parent: Context) {
    const plugin = this.resolvePlugin(name)
    if (!plugin) return

    if (this.app.lifecycle.isActive) {
      this.app.lifecycle.flush().then(() => this.check(name))
    }

    logger.info(`apply plugin %c`, name)
    Registry.validate(plugin, config)
    return parent.plugin(plugin, this.interpolate(config))
  }

  loadGroup(name: string, plugins: Dict, parent: Context) {
    logger.info(`%s group %c`, 'load', name)
    const fork = parent.plugin({ name, apply() {} }, plugins)
    const record = fork.runtime[Loader.kRecord] = Object.create(null)
    const { context } = fork.runtime
    for (const name in plugins || {}) {
      if (name.startsWith('~') || name.startsWith('$')) continue
      if (name.startsWith('+')) {
        record[name] = this.loadGroup(name.slice(1), plugins[name], context)
      } else {
        record[name] = this.loadPlugin(name, plugins[name], context)
      }
    }
    return fork
  }

  createApp() {
    const app = this.app = new App(this.config)
    app.loader = this
    app.baseDir = this.dirname
    this.runtime = this.loadGroup('Loader', this.config.plugins, app).runtime

    app.on('internal/update', (fork, value) => {
      // do not rewrite config if it's being written
      if (this.app.watcher.suspend) return
      const { runtime } = fork.parent.state
      const record = runtime[Loader.kRecord]
      if (!record) return
      for (const name in record) {
        if (record[name] !== fork) continue
        runtime.config[name] = value
        return this.writeConfig()
      }
    })

    return app
  }

  diagnose(allowCache = false) {
    for (const name in this.cache) {
      this.check(name, allowCache)
    }
  }

  private check(name: string, allowCache = false) {
    const plugin = this.resolvePlugin(name)
    const runtime = this.app.registry.get(plugin)
    if (!runtime) return

    const missing = runtime.using.filter(key => !this.app[key])
    const oldWarning = runtime[Loader.kWarning]
    runtime[Loader.kWarning] = missing.length > 0
    if (!runtime[Loader.kWarning] || allowCache && oldWarning) return
    this.app.logger('diagnostic').warn('plugin %c is missing required service %c', name, missing.join(', '))
  }

  fullReload(): never {
    logger.info('trigger full reload')
    process.exit(51)
  }
}
