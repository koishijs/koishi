import { Context, Dict, Logger, Plugin, resolveConfig } from 'koishi'
import { patch, stripModifier } from './utils'

export * from './utils'

declare module 'koishi' {
  interface Context {
    loader: Loader
    delimiter: symbol
  }

  namespace Context {
    interface Config {
      name?: string
      plugins?: Dict
    }
  }
}

declare module 'cordis' {
  // Theoretically, these properties will only appear on `Fork`.
  // We define them directly on `State` for typing convenience.
  interface State<C> {
    [Loader.kUpdate]?: boolean
    [Loader.kRecord]?: Dict<Fork<C>>
    alias?: string
  }
}

Context.service('loader')

const logger = new Logger('app')

const group: Plugin.Object = {
  name: 'group',
  reusable: true,
  apply(ctx, plugins) {
    ctx.state[Loader.kRecord] ||= Object.create(null)
    for (const name in plugins || {}) {
      if (name.startsWith('~') || name.startsWith('$')) continue
      ctx.lifecycle.queue(ctx.loader.reloadPlugin(ctx, name, plugins[name]))
    }
  },
}

export abstract class Loader {
  static readonly kUpdate = Symbol.for('koishi.loader.update')
  static readonly kRecord = Symbol.for('koishi.loader.record')
  static readonly exitCode = 51

  public app: Context
  public baseDir: string
  public config: Context.Config
  public entry: Context
  public suspend = false
  public filename: string
  public writable = true
  public envfile: string
  public cache: Dict<string> = Object.create(null)

  abstract readConfig(): Context.Config
  abstract writeConfig(): void
  abstract resolvePlugin(name: string): Promise<any>
  abstract fullReload(): void

  interpolate(source: any) {
    return source
  }

  private async forkPlugin(name: string, config: any, parent: Context) {
    const plugin = await this.resolvePlugin(name)
    if (!plugin) return

    resolveConfig(plugin, config)
    return parent.plugin(plugin, this.interpolate(config))
  }

  async reloadPlugin(parent: Context, key: string, config: any) {
    let fork = parent.state[Loader.kRecord][key]
    if (fork) {
      logger.info(`reload plugin %c`, key)
      patch(fork.parent, config)
      fork[Loader.kUpdate] = true
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
        fork = await this.forkPlugin(name, config, parent)
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
    }
  }

  async createApp() {
    const app = this.app = new Context(this.config)
    app.loader = this
    app.baseDir = this.baseDir
    app.state[Loader.kRecord] = Object.create(null)
    const fork = await this.reloadPlugin(app, 'group:entry', this.config.plugins)
    this.entry = fork.ctx

    app.on('internal/update', (fork, value) => {
      // prevent hot reload when config file is being written
      if (fork[Loader.kUpdate]) {
        fork[Loader.kUpdate] = false
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
}
