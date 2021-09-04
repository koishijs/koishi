import { isAbsolute, resolve, relative, extname, dirname } from 'path'
import { App, Context, Plugin, version, coerce, Logger, noop, Time, makeArray, template, Loader, hyphenate } from 'koishi'
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
  configExt = ['.js', '.json', '.ts', '.yaml', '.yml'].find(ext => files.includes(basename + ext))
  if (!configExt) {
    throw new Error(`config file not found. use ${yellow('koishi init')} command to initialize a config file.`)
  }
  configFile = configDir + '/' + basename + configExt
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

const oldPaths = Loader.internal.paths
Loader.internal.paths = function (name: string) {
  // resolve absolute or relative path
  if (isAbsolute(name) || name.startsWith('.')) {
    return [resolve(configDir, name)]
  }
  return oldPaths(name)
}

function ensureBaseLevel(config: Logger.LevelConfig, base: number) {
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

if (config.timezoneOffset !== undefined) {
  Time.setTimezoneOffset(config.timezoneOffset)
}

if (config.stackTraceLimit !== undefined) {
  Error.stackTraceLimit = config.stackTraceLimit
}

if (config.proxyAgent !== undefined) {
  const ProxyAgent = require('proxy-agent') as typeof import('proxy-agent')
  const axiosConfig = config.axiosConfig ||= {}
  axiosConfig.httpAgent = new ProxyAgent(config.proxyAgent)
  axiosConfig.httpsAgent = new ProxyAgent(config.proxyAgent)
}

interface Message {
  type: 'send'
  body: any
}

process.on('message', (data: Message) => {
  if (data.type === 'send') {
    const { channelId, guildId, sid, message } = data.body
    const bot = app.bots.get(sid)
    bot.sendMessage(channelId, message, guildId)
  }
})

const app = new App(config)

const { exitCommand, autoRestart = true } = config.deamon || {}

const handleSignal = (signal: NodeJS.Signals) => {
  new Logger('app').info(`terminated by ${signal}`)
  app.parallel('exit', signal).finally(() => process.exit())
}

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
    const { channelId, guildId, sid } = session
    if (!options.restart) {
      await session.send(template('deamon.exiting')).catch(noop)
      process.exit()
    }
    process.send({ type: 'queue', body: { channelId, guildId, sid, message: template('deamon.restarted') } })
    await session.send(template('deamon.restarting')).catch(noop)
    process.exit(114)
  })

const selectors = ['user', 'group', 'channel', 'self', 'private', 'platform'] as const

type SelectorType = typeof selectors[number]
type SelectorValue = boolean | string | number | (string | number)[]
type BaseSelection = { [K in SelectorType as `$${K}`]?: SelectorValue }

interface Selection extends BaseSelection {
  $union?: Selection[]
  $except?: Selection
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
config.plugins ||= {}
const plugins = new Set<string>()
for (const name in config.plugins) {
  const options = config.plugins[name]
  const path = require.resolve(Loader.resolve(hyphenate(name)))
  plugins.add(path)
  createContext(options).plugin(require(path), options)
}

process.on('unhandledRejection', (error) => {
  logger.warn(error)
})

app.start().then(() => {
  logger.info('%C', `Koishi/${version}`)

  const time = Math.max(0, performance.now() - +process.env.KOISHI_START_TIME).toFixed()
  logger.success(`bot started successfully in ${time} ms`)
  Logger.timestamp = Date.now()
  Logger.showDiff = config.logDiff ?? !Logger.showTime

  process.send({ type: 'start', body: { autoRestart } })
  createWatcher()

  process.on('SIGINT', handleSignal)
  process.on('SIGTERM', handleSignal)
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
    if (path === configFile || externals.has(path)) {
      return triggerFullReload()
    }

    // do not trigger another reload during one reload
    stashed.add(path)
    Promise.resolve(currentUpdate).then(flushChanges)
  })
}
