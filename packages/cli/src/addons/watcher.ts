import { coerce, Context, Logger, Plugin, Service } from 'koishi'
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

const logger = new Logger('app:watcher')

export default class FileWatcher extends Service {
  private root: string
  private watcher: FSWatcher
  private currentUpdate: Promise<void>

  /**
   * changes from externals E will always trigger a full reload
   *
   * - root R -> external E -> none of plugin Q
   */
  private externals: Set<string>

  /**
   * files X that should not be marked as declined
   *
   * - including all changes C
   * - some change C -> file X -> some change D
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
    const tasks: Promise<void>[] = []
    const reloads = new Map<Plugin.State, string>()

    /**
     * files X that should be reloaded
     *
     * - some plugin P -> file X -> some change C
     * - file X -> none of plugin Q -> some change D
     */
    const accepted = new Set<string>()

    /**
     * files X that should not be reloaded
     *
     * - including all externals E
     * - some change C -> file X
     * - file X -> none of change D
     */
    const declined = new Set(this.externals)
    const visited = new Set<string>()

    const traverse = (filename: string) => {
      if (declined.has(filename) || filename.includes('/node_modules/')) return
      visited.add(filename)
      const { children } = require.cache[filename]
      let isActive = this.stashed.has(filename)
      for (const module of children) {
        if (visited.has(filename)) continue
        if (traverse(module.filename)) {
          this.stashed.add(filename)
          isActive = true
        }
      }
      if (isActive) return isActive
      declined.add(filename)
    }
    Array.from(this.stashed).forEach(traverse)

    for (const filename in require.cache) {
      // we only detect reloads at plugin level
      const module = require.cache[filename]
      const state = this.ctx.app.registry.get(module.exports)
      if (!state) continue

      // check if it is a dependent of the changed file
      const dependencies = [...loadDependencies(filename, declined)]
      if (!dependencies.some(dep => this.stashed.has(dep))) continue

      // accept dependencies to be reloaded
      dependencies.forEach(dep => accepted.add(dep))
      const plugin = require(filename)

      // dispose installed plugin
      tasks.push(this.ctx.dispose(plugin).catch((err) => {
        const displayName = plugin.name || relative(this.root, filename)
        logger.warn('failed to dispose plugin %c\n' + coerce(err), displayName)
      }))

      // prepare for reload
      let ancestor = state, isMarked = false
      while ((ancestor = ancestor.parent) && !(isMarked = reloads.has(ancestor)));
      if (!isMarked) reloads.set(state, filename)
    }

    this.stashed = new Set()
    this.currentUpdate = Promise.all(tasks).then(() => {
      // delete module cache before re-require
      accepted.forEach((path) => {
        logger.debug('cache deleted:', path)
        delete require.cache[path]
      })

      // reload all dependent plugins
      for (const [state, filename] of reloads) {
        try {
          const plugin = require(filename)
          state.context.plugin(plugin, state.config)
          const displayName = plugin.name || relative(this.root, filename)
          logger.info('reload plugin %c', displayName)
        } catch (err) {
          logger.warn('failed to reload plugin at %c\n' + coerce(err), relative(this.root, filename))
        }
      }
    })
  }
}
