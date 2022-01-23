import { App, coerce, Context, Dict, Logger, Plugin, Schema } from 'koishi'
import { FSWatcher, watch, WatchOptions } from 'chokidar'
import { relative, resolve } from 'path'
import { debounce } from 'throttle-debounce'

function loadDependencies(filename: string, ignored: Set<string>) {
  const dependencies = new Set<string>()
  function traverse({ filename, children }: NodeJS.Module) {
    if (ignored.has(filename) || dependencies.has(filename) || filename.includes('/node_modules/')) return
    dependencies.add(filename)
    children.forEach(traverse)
  }
  traverse(require.cache[filename])
  return dependencies
}

function unwrap(module: any) {
  return module.default || module
}

function deepEqual(a: any, b: any) {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false

  // check array
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  } else if (Array.isArray(b)) {
    return false
  }

  // check object
  return Object.keys({ ...a, ...b }).every(key => deepEqual(a[key], b[key]))
}

const logger = new Logger('watch')

class Watcher {
  public suspend = false

  private root: string
  private watcher: FSWatcher

  /**
   * changes from externals E will always trigger a full reload
   *
   * - root R -> external E -> none of plugin Q
   */
  private externals: Set<string>

  /**
   * files X that should be reloaded
   *
   * - including all stashed files S
   * - some plugin P -> file X -> some change C
   */
  private accepted: Set<string>

  /**
   * files X that should not be reloaded
   *
   * - including all externals E
   * - some change C -> file X -> none of change D
   */
  private declined: Set<string>

  /** stashed changes */
  private stashed = new Set<string>()

  constructor(private ctx: Context, private config: Watcher.Config) {
    ctx.app.watcher = this
    ctx.on('ready', () => this.start())
    ctx.on('dispose', () => this.stop())
  }

  start() {
    const { root = '', ignored = [] } = this.config
    this.root = resolve(this.ctx.loader.dirname, root)
    this.watcher = watch(this.root, {
      ...this.config,
      ignored: ['**/node_modules/**', '**/.git/**', '**/logs/**', ...ignored],
    })

    // files independent from any plugins will trigger a full reload
    this.externals = loadDependencies(__filename, new Set(Object.keys(this.ctx.loader.cache)))
    const triggerLocalReload = debounce(this.config.debounce, () => this.triggerLocalReload())

    this.watcher.on('change', (path) => {
      const isEntry = path === this.ctx.loader.filename
      if (this.suspend && isEntry) {
        this.suspend = false
        return
      }

      logger.debug('change detected:', relative(this.root, path))

      if (isEntry) {
        if (require.cache[path]) {
          this.triggerFullReload()
        } else {
          this.triggerEntryReload()
        }
      } else {
        if (this.externals.has(path)) {
          this.triggerFullReload()
        } else if (require.cache[path]) {
          this.stashed.add(path)
          triggerLocalReload()
        }
      }
    })
  }

  stop() {
    return this.watcher.close()
  }

  private triggerFullReload() {
    logger.info('trigger full reload')
    process.exit(51)
  }

  private triggerEntryReload() {
    // use original config
    const oldConfig = this.ctx.loader.config
    this.ctx.loader.loadConfig()
    const newConfig = this.ctx.loader.config

    // check non-plugin changes
    const merged = { ...oldConfig, ...newConfig }
    delete merged.plugins
    if (Object.keys(merged).some(key => !deepEqual(oldConfig[key], newConfig[key]))) {
      return this.triggerFullReload()
    }

    // check plugin changes
    const oldPlugins = oldConfig.plugins ||= {}
    const newPlugins = newConfig.plugins ||= {}
    for (const name in { ...oldPlugins, ...newPlugins }) {
      if (name.startsWith('~') || deepEqual(oldPlugins[name], newPlugins[name])) continue

      // resolve plugin
      let plugin: any
      try {
        plugin = this.ctx.loader.resolve(name)
      } catch (err) {
        logger.warn(err.message)
        continue
      }

      // reload plugin
      const state = this.ctx.dispose(plugin)
      if (name in newPlugins) {
        logger.info(`%s plugin %c`, state ? 'reload' : 'apply', name)
        this.ctx.app.plugin(plugin, newPlugins[name])
      } else if (state) {
        logger.info(`dispose plugin %c`, name)
      }
    }
  }

  private analyzeChanges() {
    /** files pending classification */
    const pending: string[] = []

    this.accepted = new Set(this.stashed)
    this.declined = new Set(this.externals)

    this.stashed.forEach((filename) => {
      const { children } = require.cache[filename]
      for (const { filename } of children) {
        if (this.accepted.has(filename) || this.declined.has(filename) || filename.includes('/node_modules/')) continue
        pending.push(filename)
      }
    })

    while (pending.length) {
      let index = 0, hasUpdate = false
      while (index < pending.length) {
        const filename = pending[index]
        const { children } = require.cache[filename]
        let isDeclined = true, isAccepted = false
        for (const { filename } of children) {
          if (this.declined.has(filename) || filename.includes('/node_modules/')) continue
          if (this.accepted.has(filename)) {
            isAccepted = true
            break
          } else {
            isDeclined = false
            if (!pending.includes(filename)) {
              hasUpdate = true
              pending.push(filename)
            }
          }
        }
        if (isAccepted || isDeclined) {
          hasUpdate = true
          pending.splice(index, 1)
          if (isAccepted) {
            this.accepted.add(filename)
          } else {
            this.declined.add(filename)
          }
        } else {
          index++
        }
      }
      // infinite loop
      if (!hasUpdate) break
    }

    for (const filename of pending) {
      this.declined.add(filename)
    }
  }

  private triggerLocalReload() {
    this.analyzeChanges()

    /** plugins pending classification */
    const pending = new Map<string, Plugin.State>()

    /** plugins that should be reloaded */
    const reloads = new Map<Plugin.State, string>()

    // we assume that plugin entry files are "atomic"
    // that is, reloading them will not cause any other reloads
    for (const filename in require.cache) {
      const module = require.cache[filename]
      const plugin = unwrap(module.exports)
      const state = this.ctx.app.registry.get(plugin)
      if (!state || this.declined.has(filename)) continue
      pending.set(filename, state)
      if (!plugin['sideEffect']) this.declined.add(filename)
    }

    for (const [filename, state] of pending) {
      // check if it is a dependent of the changed file
      this.declined.delete(filename)
      const dependencies = [...loadDependencies(filename, this.declined)]
      if (!state.plugin['sideEffect']) this.declined.add(filename)

      // we only detect reloads at plugin level
      // a plugin will be reloaded if any of its dependencies are accepted
      if (!dependencies.some(dep => this.accepted.has(dep))) continue
      dependencies.forEach(dep => this.accepted.add(dep))

      // prepare for reload
      let ancestor = state, isMarked = false
      while ((ancestor = ancestor.parent) && !(isMarked = reloads.has(ancestor)));
      if (!isMarked) reloads.set(state, filename)
    }

    // save require.cache for rollback
    const backup: Dict<NodeJS.Module> = {}
    for (const filename of this.accepted) {
      backup[filename] = require.cache[filename]
    }

    // delete module cache before re-require
    this.accepted.forEach((path) => {
      delete require.cache[path]
    })

    // attempt to load entry files
    const attempts = {}
    try {
      for (const [, filename] of reloads) {
        attempts[filename] = unwrap(require(filename))
      }
    } catch (err) {
      // rollback require.cache
      logger.warn(err)
      return rollback()
    }

    function rollback() {
      for (const filename in backup) {
        require.cache[filename] = backup[filename]
      }
    }

    try {
      for (const [state, filename] of reloads) {
        try {
          this.ctx.dispose(state.plugin)
        } catch (err) {
          const displayName = state.plugin.name || relative(this.root, filename)
          logger.warn('failed to dispose plugin %c\n' + coerce(err), displayName)
        }

        try {
          const plugin = attempts[filename]
          state.context.plugin(plugin, state.config)
          const displayName = plugin.name || relative(this.root, filename)
          logger.info('reload plugin %c', displayName)
        } catch (err) {
          logger.warn('failed to reload plugin at %c\n' + coerce(err), relative(this.root, filename))
          throw err
        }
      }
    } catch {
      // rollback require.cache and plugin states
      rollback()
      for (const [state, filename] of reloads) {
        try {
          this.ctx.dispose(attempts[filename])
          state.context.plugin(state.plugin, state.config)
        } catch (err) {
          logger.warn(err)
        }
      }
      return
    }

    // reset stashed files
    this.stashed = new Set()
  }
}

namespace Watcher {
  export interface Config extends WatchOptions {
    root?: string
    debounce?: number
  }

  export const Config = Schema.object({
    root: Schema.string().description('要监听的根目录，相对于当前工作路径。'),
    debounce: Schema.number().default(100).description('延迟触发更新的等待时间。'),
    ignored: Schema.array(Schema.string()).description('要忽略的文件或目录。'),
  }).default(null).description('热重载设置')

  App.Config.list.push(Schema.object({
    watch: Config,
  }))
}

export default Watcher
