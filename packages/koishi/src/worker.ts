import { App, BotOptions, Context, Plugin, version } from 'koishi-core'
import { resolve, relative, extname, dirname } from 'path'
import { coerce, Logger, noop, LogLevelConfig, makeArray, template } from 'koishi-utils'
import { readFileSync, readdirSync } from 'fs'
import { performance } from 'perf_hooks'
import { yellow } from 'kleur'
import { AppConfig } from '..'

const logger = new Logger('app')
let configDir = process.cwd()

function handleException(error: any) {
  logger.error(error)
  process.exit(1)
}

process.on('uncaughtException', handleException)

let configFile: string, configExt: string
const basename = 'koishi.config'
if (process.env.KOISHI_CONFIG_FILE) {
  configFile = resolve(configDir, process.env.KOISHI_CONFIG_FILE)
  configExt = extname(configFile)
  configDir = dirname(configFile)
} else {
  const files = readdirSync(configDir)
  const ext = ['.js', '.json', '.ts', '.yaml', '.yml'].find(ext => files.includes(basename + ext))
  if (!ext) {
    throw new Error(`config file not found. use ${yellow('koishi init')} command to initialize a config file.`)
  }
  configFile = configDir + '/' + basename + ext
}

function loadConfig() {
  if (['.yaml', '.yml'].includes(configExt)) {
    const { load } = require('js-yaml') as typeof import('js-yaml')
    return load(readFileSync(configFile, 'utf8')) as any
  } else {
    const exports = require(configFile)
    return exports.__esModule ? exports.default : exports
  }
}

function isErrorModule(error: any) {
  return error.code !== 'MODULE_NOT_FOUND' || error.requireStack && error.requireStack[0] !== __filename
}

function loadEcosystem(type: string, name: string) {
  const prefix = `koishi-${type}-`
  const modules: string[] = []
  if ('./'.includes(name[0])) {
    // absolute or relative path
    modules.push(resolve(configDir, name))
  } else if (name.includes(prefix)) {
    // full package path
    modules.push(name)
  } else if (name[0] === '@') {
    // scope package path
    const index = name.lastIndexOf('/')
    modules.push(name.slice(0, index + 1) + prefix + name.slice(index + 1), name)
  } else {
    // normal package path
    modules.push(prefix + name, name)
  }

  for (const path of modules) {
    logger.debug('resolving %c', path)
    try {
      const result = require(path)
      logger.info('apply %s %c', type, result.name || name)
      return [path, result]
    } catch (error) {
      if (isErrorModule(error)) {
        throw error
      }
    }
  }
  throw new Error(`cannot resolve ${type} ${name}`)
}

function ensureBaseLevel(config: LogLevelConfig, base: number) {
  config.base ??= base
  Object.values(config).forEach((value) => {
    if (typeof value !== 'object') return
    ensureBaseLevel(value, config.base)
  })
}

const config: AppConfig = loadConfig()

// configurate logger levels
if (typeof config.logLevel === 'object') {
  Logger.levels = config.logLevel as any
} else if (typeof config.logLevel === 'number') {
  Logger.levels.base = config.logLevel
}

if (config.logTime === true) config.logTime = 'yyyy/MM/dd hh:mm:ss'
if (config.logTime) Logger.showTime = config.logTime

// cli options have higher precedence
if (process.env.KOISHI_LOG_LEVEL) {
  Logger.levels.base = +process.env.KOISHI_LOG_LEVEL
}

ensureBaseLevel(Logger.levels, 2)

if (process.env.KOISHI_DEBUG) {
  for (const name of process.env.KOISHI_DEBUG.split(',')) {
    new Logger(name).level = Logger.DEBUG
  }
}

interface Message {
  type: 'send'
  body: any
}

process.on('message', (data: Message) => {
  if (data.type === 'send') {
    const { channelId, sid, message } = data.body
    const bot = app.bots[sid]
    bot.sendMessage(channelId, message)
  }
})

function loadAdapter(bot: BotOptions) {
  const [name] = bot.type.split(':', 1)
  loadEcosystem('adapter', name)
}

// load adapter
if (config.type) {
  loadAdapter(config)
} else {
  config.bots.forEach(loadAdapter)
}

const app = new App(config)

const { exitCommand, autoRestart = true } = config.deamon || {}

const handleSignal = (signal: NodeJS.Signals) => {
  new Logger('app').info(`terminated by ${signal}`)
  app.parallel('exit', signal).finally(() => process.exit())
}

process.on('SIGINT', handleSignal)
process.on('SIGTERM', handleSignal)

template.set('deamon', {
  exiting: '正在关机……',
  restarting: '正在重启……',
  restarted: '已成功重启。',
})

exitCommand && app
  .command(exitCommand === true ? 'exit' : exitCommand, '停止机器人运行', { authority: 4 })
  .option('restart', '-r  重新启动')
  .shortcut('关机', { prefix: true })
  .shortcut('重启', { prefix: true, options: { restart: true } })
  .action(async ({ options, session }) => {
    const { channelId, sid } = session
    if (!options.restart) {
      await session.send(template('deamon.exiting')).catch(noop)
      process.exit()
    }
    process.send({ type: 'queue', body: { channelId, sid, message: template('deamon.restarted') } })
    await session.send(template('deamon.restarting')).catch(noop)
    process.exit(114)
  })

const selectors = ['user', 'group', 'channel', 'self', 'private', 'platform'] as const

type SelectorType = typeof selectors[number]
type SelectorValue = boolean | string | number | (string | number)[]
type BaseSelection = { [K in SelectorType as `$${K}`]: SelectorValue }

interface Selection extends BaseSelection {
  $union: Selection[]
  $except: Selection
}

function createContext(options: Selection) {
  let ctx: Context = app

  // basic selectors
  for (const type of selectors) {
    const value = options[`$${type}`] as SelectorValue
    if (value === true) {
      ctx = ctx[type]()
    } else if (value === false) {
      ctx = ctx[type].except()
    } else if (value !== undefined) {
      // we turn everything into string
      ctx = ctx[type](...makeArray(value).map(item => '' + item as never))
    }
  }

  // union
  if (options.$union) {
    let ctx2: Context = app
    for (const selection of options.$union) {
      ctx2 = ctx2.union(createContext(selection))
    }
    ctx = ctx.intersect(ctx2)
  }

  // except
  if (options.$except) {
    ctx = ctx.except(createContext(options.$except))
  }

  return ctx
}

// load plugins
const plugins = new Set<string>()
const pluginEntries: [string, any?][] = Array.isArray(config.plugins)
  ? config.plugins.map(item => Array.isArray(item) ? item : [item])
  : Object.entries(config.plugins || {})
for (const [name, options] of pluginEntries) {
  const [path, plugin] = loadEcosystem('plugin', name)
  plugins.add(require.resolve(path))
  createContext(options).plugin(plugin, options)
}

process.on('unhandledRejection', (error) => {
  logger.warn(error)
})

app.start().then(() => {
  logger.info('%C', `Koishi/${version}`)

  app.bots.forEach(bot => {
    logger.info('logged in to %s as %c (%s)', bot.platform, bot.username, bot.selfId)
  })

  const time = Math.max(0, performance.now() - +process.env.KOISHI_START_TIME).toFixed()
  logger.success(`bot started successfully in ${time} ms`)
  Logger.timestamp = Date.now()
  Logger.showDiff = config.logDiff ?? !Logger.showTime

  process.send({ type: 'start', body: { autoRestart } })
  createWatcher()
}, handleException)

function loadDependencies(filename: string, ignored: Set<string>) {
  const dependencies = new Set<string>()
  function traverse({ filename, children }: NodeModule) {
    if (ignored.has(filename) || dependencies.has(filename) || filename.includes('/node_modules/')) return
    dependencies.add(filename)
    children.forEach(traverse)
  }
  traverse(require.cache[filename])
  return dependencies
}

function createWatcher() {
  if (process.env.KOISHI_WATCH_ROOT === undefined && !config.watch) return

  const { watch } = require('chokidar') as typeof import('chokidar')
  const { root = '', ignored = [], fullReload } = config.watch || {}
  const watchRoot = resolve(configDir, process.env.KOISHI_WATCH_ROOT ?? root)
  const watcher = watch(watchRoot, {
    ...config.watch,
    ignored: ['**/node_modules/**', '**/.git/**', ...ignored],
  })

  /**
   * changes from externals E will always trigger a full reload
   *
   * - root R -> external E -> none of plugin Q
   */
  const externals = loadDependencies(__filename, plugins)

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
    const reloads: [filename: string, state: Plugin.State][] = []

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
      const displayName = plugin.name || relative(watchRoot, filename)
      reloads.push([filename, state])
      tasks.push(app.dispose(plugin).catch((err) => {
        logger.warn('failed to dispose plugin %c\n' + coerce(err), displayName)
      }))
    }

    stashed = new Set()
    currentUpdate = Promise.all(tasks).then(() => {
      // delete module cache before re-require
      accepted.forEach((path) => {
        logger.debug('cache deleted:', path)
        delete require.cache[path]
      })

      // reload all dependent plugins
      for (const [filename, state] of reloads) {
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
    if (path === configFile || externals.has(path)) {
      return triggerFullReload()
    }

    // do not trigger another reload during one reload
    stashed.add(path)
    Promise.resolve(currentUpdate).then(flushChanges)
  })
}
