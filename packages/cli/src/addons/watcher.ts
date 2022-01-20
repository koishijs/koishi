import { App, coerce, Context, Dict, Logger, Plugin, Schema, Service } from 'koishi'
import { FSWatcher, watch, WatchOptions } from 'chokidar'
import { relative, resolve } from 'path'
import { debounce } from 'throttle-debounce'

export interface WatchConfig extends WatchOptions {
  root?: string
  debounce?: number
}

export const WatchConfig = Schema.object({
  root: Schema.string().description('要监听的根目录，相对于当前工作路径。'),
  debounce: Schema.number().default(100).description('延迟触发更新的等待时间。'),
}).default(null).description('热重载设置')

App.Config.list.push(Schema.object({
  watch: WatchConfig,
}))

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

const logger = new Logger('watch')

export default class FileWatcher extends Service {
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

  constructor(ctx: Context, private config: WatchConfig) {
    super(ctx, 'fileWatcher')
  }

  private triggerFullReload() {
    logger.info('trigger full reload')
    process.exit(51)
  }

  start() {
    const { root = '', ignored = [] } = this.config
    this.root = resolve(this.ctx.app.loader.dirname, root)
    this.watcher = watch(this.root, {
      ...this.config,
      ignored: ['**/node_modules/**', '**/.git/**', ...ignored],
    })

    this.externals = loadDependencies(__filename, new Set(Object.keys(this.ctx.app.loader.cache)))
    const flushChanges = debounce(this.config.debounce || 100, () => this.flushChanges())

    this.watcher.on('change', (path) => {
      if (this.suspend) return
      logger.debug('change detected:', path)

      const isEntry = path === this.ctx.app.loader.filename
      if (!require.cache[path] && !isEntry) return

      // files independent from any plugins will trigger a full reload
      if (isEntry || this.externals.has(path)) {
        return this.triggerFullReload()
      }

      // do not trigger another reload during one reload
      this.stashed.add(path)
      flushChanges()
    })
  }

  stop() {
    return this.watcher.close()
  }

  private prepareReload() {
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

  private flushChanges() {
    this.prepareReload()

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
      for (const [_, filename] of reloads) {
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
