import { Context, deepEqual, Dict, Logger, Plugin, resolveConfig } from 'koishi'
import { patch, stripModifier } from './utils'

export * from './utils'

declare module 'koishi' {
  interface Context {
    loader: Loader
    delimiter: symbol
  }

  interface Events {
    'config'(): void
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
    [Loader.kRecord]?: Dict<Fork<C>>
    alias?: string
  }
}

const kUpdate = Symbol('update')

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

    ctx.accept((neo) => {
      // update config reference
      const old = ctx.state.config

      // update group modifier
      if (!deepEqual(old.$filter || {}, neo.$filter || {})) {
        patch.filter(ctx.state.parent, neo.$filter)
      }
      if (!deepEqual(old.$isolate || [], neo.$isolate || [])) {
        patch.isolate(ctx.state.parent, neo.$isolate)
      }

      // update inner plugins
      for (const key in { ...old, ...neo }) {
        if (key.startsWith('~') || key.startsWith('$')) continue
        const fork = ctx.state[Loader.kRecord][key]
        if (!fork) {
          ctx.loader.reloadPlugin(ctx, key, neo[key])
        } else if (!(key in neo)) {
          ctx.loader.unloadPlugin(ctx, key)
        } else {
          ctx.loader.reloadPlugin(ctx, key, neo[key] || {})
        }
      }
    }, { passive: true })
  },
}

export abstract class Loader {
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
      patch(fork.parent, config)
      fork[kUpdate] = true
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

    app.accept(['plugins'], (config) => {
      fork[kUpdate] = true
      fork.update(config.plugins)
    }, { passive: true })

    app.on('dispose', () => {
      this.fullReload()
    })

    app.on('internal/update', (fork) => {
      const record = fork.parent.state[Loader.kRecord]
      if (!record) return
      for (const name in record) {
        if (record[name] !== fork) continue
        logger.info(`reload plugin %c`, name)
      }
    })

    app.on('internal/before-update', (fork, config) => {
      if (fork[kUpdate]) return delete fork[kUpdate]
      const record = fork.parent.state[Loader.kRecord]
      if (!record) return
      for (const name in record) {
        if (record[name] !== fork) continue
        fork.parent.state.config[name] = config
      }
    })

    return app
  }
}
