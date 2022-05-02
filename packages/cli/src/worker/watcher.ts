import { App, coerce, Context, Dict, Logger, makeArray, Plugin, Schema } from 'koishi'
import { FSWatcher, watch, WatchOptions } from 'chokidar'
import { relative, resolve } from 'path'
import { debounce } from 'throttle-debounce'
import ns from 'ns-require'

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

function deepEqual(a: any, b: any) {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false
  if (!a || !b) return false

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
    const { loader } = this.ctx
    const { root = '', ignored = [] } = this.config
    this.root = resolve(loader.dirname, root)
    this.watcher = watch(this.root, {
      ...this.config,
      ignored: ['**/node_modules/**', '**/.git/**', '**/logs/**', ...makeArray(ignored)],
    })

    // files independent from any plugins will trigger a full reload
    this.externals = loadDependencies(__filename, new Set(Object.values(loader.cache)))
    const triggerLocalReload = debounce(this.config.debounce, () => this.triggerLocalReload())

    this.watcher.on('change', (path) => {
      const isEntry = path === loader.filename || path === loader.envfile
      if (this.suspend && isEntry) {
        this.suspend = false
        return
      }

      logger.debug('change detected:', relative(this.root, path))

      if (isEntry) {
        if (require.cache[path]) {
          this.ctx.loader.fullReload()
        } else {
          this.triggerEntryReload()
        }
      } else {
        if (this.externals.has(path)) {
          this.ctx.loader.fullReload()
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

  private triggerEntryReload() {
    // use original config
    const { loader } = this.ctx
    const oldConfig = loader.config
    loader.readConfig()
    const newConfig = loader.config

    // check non-plugin changes
    const merged = { ...oldConfig, ...newConfig }
    delete merged.plugins
    if (Object.keys(merged).some(key => !deepEqual(oldConfig[key], newConfig[key]))) {
      return this.ctx.loader.fullReload()
    }

    // check plugin changes
    const oldPlugins = oldConfig.plugins
    const newPlugins = newConfig.plugins
    for (const name in { ...oldPlugins, ...newPlugins }) {
      if (name.startsWith('~')) continue
      if (deepEqual(oldPlugins[name], newPlugins[name])) continue
      if (name in newPlugins) {
        loader.reloadPlugin(name)
      } else {
        loader.unloadPlugin(name)
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
      const plugin = ns.unwrapExports(module.exports)
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
      while ((ancestor = ancestor.parent?.state) && !(isMarked = reloads.has(ancestor)));
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
        attempts[filename] = ns.unwrapExports(require(filename))
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
        const path = relative(this.root, filename)

        try {
          this.ctx.dispose(state.plugin)
        } catch (err) {
          logger.warn('failed to dispose plugin at %c\n' + coerce(err), path)
        }

        try {
          const plugin = attempts[filename]
          state.parent.plugin(plugin, state.config)
          logger.info('reload plugin at %c', path)
        } catch (err) {
          logger.warn('failed to reload plugin at %c\n' + coerce(err), path)
          throw err
        }
      }
    } catch {
      // rollback require.cache and plugin states
      rollback()
      for (const [state, filename] of reloads) {
        try {
          this.ctx.dispose(attempts[filename])
          state.parent.plugin(state.plugin, state.config)
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
    debounce: Schema.natural().role('ms').default(100).description('延迟触发更新的等待时间。'),
    ignored: Schema.union([
      Schema.array(String),
      Schema.transform(String, (value) => [value]),
    ]).description('要忽略的文件或目录。'),
  }).description('热重载设置')

  App.Config.list.push(Schema.object({
    watch: Config,
  }))
}

export default Watcher
