import { Context, Dict, EffectScope, ForkScope, interpolate, isNullable, Logger, Plugin, Universal, valueMap, version } from '@koishijs/core'
import { constants, promises as fs } from 'fs'
import * as yaml from 'js-yaml'
import * as path from 'path'

declare module '@koishijs/core' {
  interface Events {
    'config'(): void
    'exit'(signal: NodeJS.Signals): Promise<void>
  }

  interface Context {
    loader: Loader
  }

  namespace Context {
    interface Config {
      name?: string
      plugins?: Dict
    }
  }

  interface EnvData {
    message?: StartMessage
    startTime?: number
  }
}

interface StartMessage {
  isDirect?: boolean
  channelId?: string
  guildId?: string
  sid?: string
  content: string
}

declare module 'cordis' {
  // Theoretically, these properties will only appear on `ForkScope`.
  // We define them directly on `EffectScope` for typing convenience.
  interface EffectScope<C> {
    [Loader.kRecord]?: Dict<ForkScope<C>>
    key?: string
  }
}

export function unwrapExports(module: any) {
  return module?.default || module
}

function separate(source: any, isGroup = false) {
  const config: any = {}, meta: any = {}
  for (const [key, value] of Object.entries(source || {})) {
    if (key.startsWith('$')) {
      meta[key] = value
    } else {
      config[key] = value
    }
  }
  return [isGroup ? source : config, meta]
}

const kUpdate = Symbol('update')

const group: Plugin.Object<Context> = {
  name: 'group',
  reusable: true,
  apply(ctx, plugins) {
    ctx.scope[Loader.kRecord] ||= Object.create(null)

    for (const name in plugins || {}) {
      if (name.startsWith('~') || name.startsWith('$')) continue
      ctx.loader.reload(ctx, name, plugins[name])
    }

    ctx.accept((neo) => {
      // update config reference
      const old = ctx.scope.config

      // update inner plugins
      for (const key in { ...old, ...neo }) {
        if (key.startsWith('~') || key.startsWith('$')) continue
        const fork = ctx.scope[Loader.kRecord][key]
        if (!fork) {
          ctx.loader.reload(ctx, key, neo[key])
        } else if (!(key in neo)) {
          ctx.loader.unload(ctx, key)
        } else {
          ctx.loader.reload(ctx, key, neo[key] || {})
        }
      }
    }, { passive: true })
  },
}

const writable = {
  '.json': 'application/json',
  '.yaml': 'application/yaml',
  '.yml': 'application/yaml',
}

export abstract class Loader {
  static readonly kRecord = Symbol.for('koishi.loader.record')
  static readonly exitCode = 51
  static readonly extensions = new Set(Object.keys(writable))

  // process
  public baseDir = process.cwd()
  public envData = process.env.KOISHI_SHARED
    ? JSON.parse(process.env.KOISHI_SHARED)
    : { startTime: Date.now() }

  public params = {
    env: process.env,
  }

  public app: Context
  public config: Context.Config
  public entry: Context
  public suspend = false
  public writable = false
  public mime: string
  public filename: string
  public envFiles: string[]
  public names = new Set<string>()
  public cache: Dict<string> = Object.create(null)
  public prolog: Logger.Record[] = []

  private store = new WeakMap<any, string>()

  abstract import(name: string): Promise<any>
  abstract fullReload(code?: number): void

  constructor() {
    Logger.targets.push({
      colors: 3,
      record: (record) => {
        this.prolog.push(record)
        this.prolog = this.prolog.slice(-1000)
      },
    })
  }

  async init(filename?: string) {
    if (filename) {
      filename = path.resolve(this.baseDir, filename)
      const stats = await fs.stat(filename)
      if (stats.isFile()) {
        this.filename = filename
        this.baseDir = path.dirname(filename)
        const extname = path.extname(filename)
        this.mime = writable[extname]
        if (!Loader.extensions.has(extname)) {
          throw new Error(`extension "${extname}" not supported`)
        }
      } else {
        this.baseDir = filename
        await this.findConfig()
      }
    } else {
      await this.findConfig()
    }
    if (this.mime) {
      try {
        await fs.access(this.filename, constants.W_OK)
        this.writable = true
      } catch {}
    }
    this.envFiles = [
      path.resolve(this.baseDir, '.env'),
      path.resolve(this.baseDir, '.env.local'),
    ]
  }

  private async findConfig() {
    const files = await fs.readdir(this.baseDir)
    for (const basename of ['koishi.config', 'koishi']) {
      for (const extname of Loader.extensions) {
        if (files.includes(basename + extname)) {
          this.mime = writable[extname]
          this.filename = path.resolve(this.baseDir, basename + extname)
          return
        }
      }
    }
    throw new Error('config file not found')
  }

  private migrateGroup(plugins: Dict) {
    const backup = { ...plugins }
    for (const key in backup) delete plugins[key]
    for (const key in backup) {
      if (key.startsWith('$')) {
        plugins[key] = backup[key]
        continue
      }
      const [name] = key.split(':', 1)
      const isGroup = name === 'group' || name === '~group'
      if (isGroup) this.migrateGroup(backup[key])
      let ident = key.slice(name.length + 1)
      if (ident && !this.names.has(ident)) {
        this.names.add(ident)
        plugins[key] = backup[key]
        continue
      }
      ident = Math.random().toString(36).slice(2, 8)
      plugins[`${name}:${ident}`] = backup[key]
    }
  }

  async migrate() {
    this.migrateGroup(this.config.plugins)
  }

  async readConfig(initial = false) {
    if (this.mime === 'application/yaml') {
      this.config = yaml.load(await fs.readFile(this.filename, 'utf8')) as any
    } else if (this.mime === 'application/json') {
      // we do not use require here because it will pollute require.cache
      this.config = JSON.parse(await fs.readFile(this.filename, 'utf8')) as any
    } else {
      const module = require(this.filename)
      this.config = module.default || module
    }

    if (initial) await this.migrate()
    if (this.writable) await this.writeConfig(true)
    return new Context.Config(this.interpolate(this.config))
  }

  async writeConfig(silent = false) {
    this.suspend = true
    if (!this.writable) {
      throw new Error(`cannot overwrite readonly config`)
    }
    if (this.mime === 'application/yaml') {
      await fs.writeFile(this.filename, yaml.dump(this.config))
    } else if (this.mime === 'application/json') {
      await fs.writeFile(this.filename, JSON.stringify(this.config, null, 2))
    }
    if (!silent) this.app.emit('config')
  }

  interpolate(source: any) {
    if (typeof source === 'string') {
      return interpolate(source, this.params, /\$\{\{(.+?)\}\}/g)
    } else if (!source || typeof source !== 'object') {
      return source
    } else if (Array.isArray(source)) {
      return source.map(item => this.interpolate(item))
    } else {
      return valueMap(source, item => this.interpolate(item))
    }
  }

  async resolve(name: string) {
    const plugin = unwrapExports(await this.import(name))
    if (plugin) this.store.set(this.app.registry.resolve(plugin), name)
    return plugin
  }

  keyFor(plugin: any) {
    const name = this.store.get(this.app.registry.resolve(plugin))
    if (name) return name.replace(/(koishi-|^@koishijs\/)plugin-/, '')
  }

  replace(oldKey: any, newKey: any) {
    oldKey = this.app.registry.resolve(oldKey)
    newKey = this.app.registry.resolve(newKey)
    const name = this.store.get(oldKey)
    if (!name) return
    this.store.set(newKey, name)
    this.store.delete(oldKey)
  }

  private async forkPlugin(name: string, config: any, parent: Context) {
    const plugin = await this.resolve(name)
    if (!plugin) return

    return parent.plugin(plugin, this.interpolate(config))
  }

  isTruthyLike(expr: any) {
    if (isNullable(expr)) return true
    return !!this.interpolate(`\${{ ${expr} }}`)
  }

  private logUpdate(type: string, parent: Context, key: string) {
    this.app.logger('loader').info('%s plugin %c', type, key)
  }

  async reload(parent: Context, key: string, source: any) {
    let fork = parent.scope[Loader.kRecord][key]
    const name = key.split(':', 1)[0]
    const [config, meta] = separate(source, name === 'group')
    if (fork) {
      if (!this.isTruthyLike(meta.$if)) {
        this.unload(parent, key)
        return
      }
      fork[kUpdate] = true
      fork.update(config)
    } else {
      if (!this.isTruthyLike(meta.$if)) return
      this.logUpdate('apply', parent, key)
      const ctx = parent.extend()
      if (name === 'group') {
        fork = ctx.plugin(group, config)
      } else {
        fork = await this.forkPlugin(name, config, ctx)
      }
      if (!fork) return
      ctx[Loader.ancestor] = fork.uid
      fork.key = key.slice(name.length + 1)
      parent.scope[Loader.kRecord][key] = fork
    }
    const filter = this.interpolate(meta.$filter)
    fork.parent.filter = (session) => {
      return parent.filter(session) && (isNullable(filter) || session.resolve(filter))
    }
    return fork
  }

  unload(ctx: Context, key: string) {
    const fork = ctx.scope[Loader.kRecord][key]
    if (fork) {
      this.logUpdate('unload', ctx, key)
      fork.dispose()
      delete ctx.scope[Loader.kRecord][key]
    }
  }

  getRefName(fork: ForkScope) {
    const record = fork.parent.scope[Loader.kRecord]
    if (!record) return
    for (const name in record) {
      if (record[name] !== fork) continue
      return name
    }
  }

  /** @deprecated */
  resolvePlugin(name: string) {
    return this.resolve(name)
  }

  /** @deprecated */
  reloadPlugin(ctx: Context, key: string, source: any) {
    return this.reload(ctx, key, source)
  }

  /** @deprecated */
  unloadPlugin(ctx: Context, key: string) {
    return this.unload(ctx, key)
  }

  paths(scope: EffectScope): string[] {
    // root scope
    if (scope === scope.parent.scope) return []

    // runtime scope
    if (scope.runtime === scope) {
      return [].concat(...scope.runtime.children.map(child => this.paths(child)))
    }

    if (scope.key) return [scope.key]
    return this.paths(scope.parent.scope)
  }

  async createApp() {
    new Logger('app').info('%C', `Koishi/${version}`)
    const app = this.app = new Context(this.interpolate(this.config))
    app.provide('loader', this, true)
    app.provide('baseDir', this.baseDir, true)
    app.scope[Loader.kRecord] = Object.create(null)
    const fork = await this.reload(app, 'group:entry', this.config.plugins)
    this.entry = fork.ctx

    app.accept(['plugins'], (config) => {
      this.reload(app, 'group:entry', config.plugins)
    }, { passive: true })

    app.on('dispose', () => {
      this.fullReload()
    })

    app.on('internal/update', (fork) => {
      const key = this.getRefName(fork)
      if (key) this.logUpdate('reload', fork.parent, key)
    })

    app.on('internal/before-update', (fork, config) => {
      if (fork[kUpdate]) return delete fork[kUpdate]
      const name = this.getRefName(fork)
      if (!name) return
      const { schema } = fork.runtime
      fork.parent.scope.config[name] = {
        ...separate(fork.parent.scope.config[name])[1],
        ...schema ? schema.simplify(config) : config,
      }
      this.writeConfig()
    })

    if (this.envData.message) {
      const { sid, channelId, guildId, content } = this.envData.message
      this.envData.message = null
      const dispose = app.on('bot-status-updated', (bot) => {
        if (bot.sid !== sid || bot.status !== Universal.Status.ONLINE) return
        dispose()
        bot.sendMessage(channelId, content, guildId)
      })
    }

    return app
  }
}
