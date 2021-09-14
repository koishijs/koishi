import { App, coerce, Logger, Plugin } from 'koishi'
import { relative, resolve } from 'path'
import { Loader } from '../loader'

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

export function createFileWatcher(app: App, loader: Loader) {
  if (process.env.KOISHI_WATCH_ROOT === undefined && !app.options.watch) return

  const { watch } = require('chokidar') as typeof import('chokidar')
  const { root = '', ignored = [], fullReload } = app.options.watch || {}
  const watchRoot = resolve(loader.dirname, process.env.KOISHI_WATCH_ROOT ?? root)
  const watcher = watch(watchRoot, {
    ...app.options.watch,
    ignored: ['**/node_modules/**', '**/.git/**', ...ignored],
  })

  /**
   * changes from externals E will always trigger a full reload
   *
   * - root R -> external E -> none of plugin Q
   */
  const externals = loadDependencies(__filename, new Set(Object.keys(loader.cache)))

  const logger = new Logger('app:watcher')
  function triggerFullReload() {
    if (fullReload === false) return
    logger.info('trigger full reload')
    process.exit(114)
  }

  /**
   * files X that should not be marked as declined
   *
   * - including all changes C
   * - some change C -> file X -> some change D
   */
  let stashed = new Set<string>()
  let currentUpdate: Promise<void>

  function flushChanges() {
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
    const declined = new Set(externals)
    const visited = new Set<string>()

    function traverse(filename: string) {
      if (declined.has(filename) || filename.includes('/node_modules/')) return
      visited.add(filename)
      const { children } = require.cache[filename]
      let isActive = stashed.has(filename)
      for (const module of children) {
        if (visited.has(filename)) continue
        if (traverse(module.filename)) {
          stashed.add(filename)
          isActive = true
        }
      }
      if (isActive) return isActive
      declined.add(filename)
    }
    Array.from(stashed).forEach(traverse)

    for (const filename in require.cache) {
      // we only detect reloads at plugin level
      const module = require.cache[filename]
      const state = app.registry.get(module.exports)
      if (!state) continue

      // check if it is a dependent of the changed file
      const dependencies = [...loadDependencies(filename, declined)]
      if (!dependencies.some(dep => stashed.has(dep))) continue

      // accept dependencies to be reloaded
      dependencies.forEach(dep => accepted.add(dep))
      const plugin = require(filename)
      if (state?.sideEffect) {
        triggerFullReload()
        continue
      }

      // dispose installed plugin
      tasks.push(app.dispose(plugin).catch((err) => {
        const displayName = plugin.name || relative(watchRoot, filename)
        logger.warn('failed to dispose plugin %c\n' + coerce(err), displayName)
      }))

      // prepare for reload
      let ancestor = state, isMarked = false
      while ((ancestor = ancestor.parent) && !(isMarked = reloads.has(ancestor)));
      if (!isMarked) reloads.set(state, filename)
    }

    stashed = new Set()
    currentUpdate = Promise.all(tasks).then(() => {
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
          const displayName = plugin.name || relative(watchRoot, filename)
          logger.info('reload plugin %c', displayName)
        } catch (err) {
          logger.warn('failed to reload plugin at %c\n' + coerce(err), relative(watchRoot, filename))
        }
      }
    })
  }

  watcher.on('change', (path) => {
    if (!require.cache[path]) return
    logger.debug('change detected:', path)

    // files independent from any plugins will trigger a full reload
    if (path === loader.filename || externals.has(path)) {
      return triggerFullReload()
    }

    // do not trigger another reload during one reload
    stashed.add(path)
    Promise.resolve(currentUpdate).then(flushChanges)
  })
}
