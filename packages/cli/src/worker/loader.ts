import { resolve } from 'path'
import { Context, Dict, interpolate, Logger, Plugin, valueMap } from 'koishi'
import { resolveConfig } from 'cordis'
import { patch, stripModifier } from './utils'
import ConfigLoader from '@koishijs/loader'
import * as dotenv from 'dotenv'
import ns from 'ns-require'

declare module 'koishi' {
  interface Context {
    loader: Loader
    delimiter: symbol
  }
}

declare module 'cordis' {
  interface Runtime {
    [Loader.kWarning]?: boolean
  }

  // Theoretically, these properties will only appear on `Fork`.
  // We define them directly on `State` for typing convenience.
  interface State<C> {
    [Loader.update]?: boolean
    [Loader.kRecord]?: Dict<Fork<C>>
    alias?: string
  }
}

Context.service('loader')

const logger = new Logger('app')

const context = {
  env: process.env,
}

const group: Plugin.Object = {
  name: 'group',
  reusable: true,
  apply(ctx, plugins) {
    ctx.state[Loader.kRecord] ||= Object.create(null)
    for (const name in plugins || {}) {
      if (name.startsWith('~') || name.startsWith('$')) continue
      ctx.loader.reloadPlugin(ctx, name, plugins[name])
    }
  },
}

export default class Loader extends ConfigLoader<Context.Config> {
  static readonly unique = Symbol.for('koishi.loader.unique')
  static readonly update = Symbol.for('koishi.loader.update')
  static readonly kRecord = Symbol.for('koishi.loader.record')
  static readonly kWarning = Symbol.for('koishi.loader.warning')

  app: Context
  config: Context.Config
  entry: Context
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

    let resolved = new Context.Config(config)
    if (this.writable) {
      // schemastery may change original config
      // so we need to validate config twice
      resolved = new Context.Config(this.interpolate(config))
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

  private forkPlugin(name: string, config: any, parent: Context) {
    const plugin = this.resolvePlugin(name)
    if (!plugin) return

    if (this.app.lifecycle.isActive) {
      this.app.lifecycle.flush().then(() => this.check(name))
    }

    resolveConfig(plugin, config)
    return parent.plugin(plugin, this.interpolate(config))
  }

  reloadPlugin(parent: Context, key: string, config: any) {
    let fork = parent.state[Loader.kRecord][key]
    if (fork) {
      logger.info(`reload plugin %c`, key)
      patch(fork.parent, config)
      fork[Loader.update] = true
      fork.update(config)
    } else {
      logger.info(`apply plugin %c`, key)
      const name = key.split(':', 1)[0]
      if (name === 'group') {
        const ctx = parent.isolate([])
        ctx.delimiter = Symbol('unique')
        ctx[ctx.delimiter] = true
        patch(ctx, config)
        fork = ctx.plugin(group, config)
      } else {
        config = stripModifier(config)
        fork = this.forkPlugin(name, config, parent)
      }
      if (!fork) return
      fork.alias = key.slice(name.length + 1)
      parent.state[Loader.kRecord][key] = fork
    }
    return fork
  }

  unloadPlugin(ctx: Context, key: string) {
    const fork = ctx.state[Loader.kRecord][key]
    if (fork) {
      fork.dispose()
      delete ctx.state[Loader.kRecord][key]
      logger.info(`unload plugin %c`, key)
      this.diagnose(true)
    }
  }

  createApp() {
    const app = this.app = new Context(this.config)
    app.loader = this
    app.baseDir = this.dirname
    app.state[Loader.kRecord] = Object.create(null)
    this.entry = this.reloadPlugin(app, 'group:entry', this.config.plugins).ctx

    app.on('internal/update', (fork, value) => {
      // prevent hot reload when config file is being written
      if (fork[Loader.update]) {
        fork[Loader.update] = false
        return
      }

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
