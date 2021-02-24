import { App, BotOptions, version } from 'koishi-core'
import { resolve, dirname } from 'path'
import { coerce, Logger, noop } from 'koishi-utils'
import { performance } from 'perf_hooks'
import { watch } from 'chokidar'
import { yellow } from 'kleur'
import { AppConfig } from '..'

const logger = new Logger('app')

function handleException(error: any) {
  logger.error(error)
  process.exit(1)
}

process.on('uncaughtException', handleException)

const configFile = resolve(process.cwd(), process.env.KOISHI_CONFIG_FILE || 'koishi.config')
const configDir = dirname(configFile)

function isErrorModule(error: any) {
  return error.code !== 'MODULE_NOT_FOUND' || error.requireStack && error.requireStack[0] !== __filename
}

function tryCallback<T>(callback: () => T) {
  try {
    return callback()
  } catch (error) {
    if (isErrorModule(error) && error.code !== 'ENOENT') {
      throw error
    }
  }
}

const config: AppConfig = tryCallback(() => require(configFile))

if (!config) {
  throw new Error(`config file not found. use ${yellow('koishi init')} command to initialize a config file.`)
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

// configurate logger levels
if (typeof config.logLevel === 'object') {
  Object.assign(Logger.levels, config.logLevel)
} else if (typeof config.logLevel === 'number') {
  Logger.levels.base = config.logLevel
}

if (config.logTime === true) config.logTime = 'YYYY/MM/DD hh:mm:ss'
if (config.logTime) Logger.showTime = config.logTime

// cli options have higher precedence
if (process.env.KOISHI_LOG_LEVEL) {
  Logger.levels.base = +process.env.KOISHI_LOG_LEVEL
}

if (process.env.KOISHI_DEBUG) {
  for (const name of process.env.KOISHI_DEBUG.split(',')) {
    new Logger(name).level = Logger.DEBUG
  }
}

interface Message {
  type: 'send'
  payload: any
}

process.on('message', (data: Message) => {
  if (data.type === 'send') {
    const { channelId, sid, message } = data.payload
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

app.command('exit', '停止机器人运行', { authority: 4 })
  .option('restart', '-r  重新启动')
  .shortcut('关机', { prefix: true })
  .shortcut('重启', { prefix: true, options: { restart: true } })
  .action(async ({ options, session }) => {
    const { channelId, sid } = session
    if (!options.restart) {
      await session.send('正在关机……').catch(noop)
      process.exit()
    }
    process.send({ type: 'exit', payload: { channelId, sid, message: '已成功重启。' } })
    await session.send(`正在重启……`).catch(noop)
    process.exit(114)
  })

// load plugins
const pluginMap = new Map<string, [name: string, options: any]>()
const pluginEntries: [string, any?][] = Array.isArray(config.plugins)
  ? config.plugins.map(item => Array.isArray(item) ? item : [item])
  : Object.entries(config.plugins || {})
for (const [name, options] of pluginEntries) {
  const [path, plugin] = loadEcosystem('plugin', name)
  if (plugin.disposable) {
    pluginMap.set(require.resolve(path), [name, options])
  }
  app.plugin(plugin, options)
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
  Logger.showDiff = true

  process.send({ type: 'start' })
  createWatcher()
}, handleException)

interface MapOrSet<T> {
  has(value: T): boolean
}

function loadDependencies(filename: string, ignored: MapOrSet<string>) {
  const dependencies = new Set<string>()
  function loadModule({ filename, children }: NodeModule) {
    if (ignored.has(filename) || dependencies.has(filename)) return
    dependencies.add(filename)
    children.forEach(loadModule)
  }
  loadModule(require.cache[filename])
  return dependencies
}

function createWatcher() {
  if (process.env.KOISHI_WATCH_ROOT === undefined && !config.watch) return

  const { root = '', ignored = [] } = config.watch || {}
  const watchRoot = process.env.KOISHI_WATCH_ROOT ?? root
  const externals = loadDependencies(__filename, pluginMap)
  const watcher = watch(resolve(process.cwd(), watchRoot), {
    ...config.watch,
    ignored: ['**/node_modules/**', '**/.git/**', ...ignored],
  })

  watcher.on('change', (path) => {
    if (!require.cache[path] || externals.has(path)) return
    logger.debug('change detected:', path)

    /** files that should be reloaded */
    const accepted = new Set<string>()
    /** files that should not be reloaded */
    const declined = new Set([...externals, loadDependencies(path, externals)])
    declined.delete(path)

    const plugins: string[] = []
    for (const [filename] of pluginMap) {
      const dependencies = loadDependencies(filename, declined)
      if (dependencies.has(path)) {
        dependencies.forEach(dep => accepted.add(dep))

        // dispose installed plugin
        plugins.push(filename)
        app.dispose(require(filename))
      }
    }

    accepted.forEach(dep => delete require.cache[dep])
    for (const filename of plugins) {
      const plugin = require(filename)
      const [name, options] = pluginMap.get(filename)
      const displayName = plugin.name || name
      Logger.clearScreen()
      try {
        app.plugin(plugin, options)
        logger.info('reload plugin %c', displayName)
      } catch (err) {
        logger.warn('failed to reload plugin %c\n' + coerce(err), displayName)
      }
    }
  })
}
