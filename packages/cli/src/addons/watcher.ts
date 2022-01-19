import { coerce, Context, Dict, Logger, Plugin, Service } from 'koishi'
import { FSWatcher, watch, WatchOptions } from 'chokidar'
import { relative, resolve } from 'path'

export interface WatchConfig extends WatchOptions {
  root?: string
  fullReload?: boolean
}

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
  private root: string
  private watcher: FSWatcher
  private currentUpdate: Promise<void[]>

  /**
   * changes from externals E will always trigger a full reload
   *
   * - root R -> external E -> none of plugin Q
   */
  private externals: Set<string>

  /**
   * stashed files that will trigger a partial reload
   */
  private stashed = new Set<string>()

  constructor(ctx: Context, private config: WatchConfig) {
    super(ctx, 'fileWatcher')
  }

  start() {
    const { root = '', ignored = [], fullReload } = this.config
    this.root = resolve(this.ctx.app.loader.dirname, root)
    this.watcher = watch(this.root, {
      ...this.config,
      ignored: ['**/node_modules/**', '**/.git/**', ...ignored],
    })

    this.externals = loadDependencies(__filename, new Set(Object.keys(this.ctx.app.loader.cache)))

    function triggerFullReload() {
      if (fullReload === false) return
      logger.info('trigger full reload')
      process.exit(51)
    }

    this.watcher.on('change', (path) => {
      if (!require.cache[path]) return
      logger.debug('change detected:', path)

      // files independent from any plugins will trigger a full reload
      if (path === this.ctx.app.loader.filename || this.externals.has(path)) {
        return triggerFullReload()
      }

      // do not trigger another reload during one reload
      this.stashed.add(path)
      Promise.resolve(this.currentUpdate).then(() => this.flushChanges())
    })
  }

  stop() {
    return this.watcher.close()
  }

  private flushChanges() {
    const reloads = new Map<Plugin.State, string>()

    /**
     * files X that should be reloaded
     *
     * - including all stashed files S
     * - some plugin P -> file X -> some change C
     */
    const accepted = new Set<string>(this.stashed)

    /**
     * files X that should not be reloaded
     *
     * - including all externals E
     * - some change C -> file X -> none of change D
     */
    const declined = new Set(this.externals)

    /**
     * files X that will be classified as accepted or declined
     */
    const pending: string[] = []

    this.stashed.forEach((filename) => {
      const { children } = require.cache[filename]
      for (const { filename } of children) {
        if (accepted.has(filename) || declined.has(filename) || filename.includes('/node_modules/')) continue
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
          if (declined.has(filename) || filename.includes('/node_modules/')) continue
          if (accepted.has(filename)) {
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
            accepted.add(filename)
          } else {
            declined.add(filename)
          }
        } else {
          index++
        }
      }
      // infinite loop
      if (!hasUpdate) break
    }

    for (const filename of pending) {
      declined.add(filename)
    }

    /**
     * a map from filename to plugin state
     */
    const plugins = new Map<string, Plugin.State>()

    for (const filename in require.cache) {
      // we only detect reloads at plugin level
      const module = require.cache[filename]
      const plugin = unwrap(module.exports)
      const state = this.ctx.app.registry.get(plugin)
      if (!state) continue
      plugins.set(filename, state)
      if (!plugin.sideEffect) declined.add(filename)
    }

    for (const [filename, state] of plugins) {
      // check if it is a dependent of the changed file
      declined.delete(filename)
      const dependencies = [...loadDependencies(filename, declined)]
      declined.add(filename)
      if (!dependencies.some(dep => accepted.has(dep))) continue

      // accept dependencies to be reloaded
      dependencies.forEach(dep => accepted.add(dep))

      // prepare for reload
      let ancestor = state, isMarked = false
      while ((ancestor = ancestor.parent) && !(isMarked = reloads.has(ancestor)));
      if (!isMarked) reloads.set(state, filename)
    }

    // save require.cache for recovery
    const backup: Dict<NodeJS.Module> = {}
    for (const filename of accepted) {
      backup[filename] = require.cache[filename]
    }

    // delete module cache before re-require
    accepted.forEach((path) => {
      logger.debug('cache deleted:', path)
      delete require.cache[path]
    })

    // attempt to load entry files
    const attempts = {}
    try {
      for (const [_, filename] of reloads) {
        attempts[filename] = unwrap(require(filename))
      }
    } catch (err) {
      logger.warn(err)
      this.currentUpdate = null
      return rollback()
    }

    function rollback() {
      for (const filename in backup) {
        require.cache[filename] = backup[filename]
      }
    }

    // reload all associated plugins
    const tasks = Array.from(reloads).map(async ([state, filename]) => {
      try {
        await this.ctx.dispose(state.plugin)
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
    })

    this.stashed = new Set()
    this.currentUpdate = Promise.all(tasks).catch(() => {
      rollback()
      // rollback require.cache and plugin states
      return Promise.all(Array.from(reloads).map(async ([state, filename]) => {
        try {
          await this.ctx.dispose(attempts[filename])
        } catch (err) {
          logger.warn(err)
        }

        try {
          state.context.plugin(state.plugin, state.config)
        } catch (err) {
          logger.warn(err)
        }
      }))
    })
  }
}
