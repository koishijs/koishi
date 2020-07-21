import { App, AppOptions, Context, Plugin, appList, startAll, onStart } from 'koishi-core'
import { resolve, dirname } from 'path'
import { capitalize, Logger } from 'koishi-utils'
import { performance } from 'perf_hooks'
import { yellow } from 'kleur'
import { format } from 'util'

const logger = Logger.create('app')
const { version } = require('../package')

if (process.env.KOISHI_LOG_LEVEL) {
  Logger.baseLevel = +process.env.KOISHI_LOG_LEVEL
}

if (process.env.KOISHI_DEBUG) {
  Logger.levels = Object.fromEntries(process.env.KOISHI_DEBUG.split(',').map(name => [name, 3]))
}

function handleException (error: any) {
  logger.error(error)
  process.exit(1)
}

process.on('uncaughtException', handleException)

export type PluginConfig = (string | Plugin<Context> | [string | Plugin<Context>, any?])[]

export interface AppConfig extends AppOptions {
  plugins?: PluginConfig | Record<string, PluginConfig>
  logLevel?: number
  logFilter?: Record<string, number>
}

const configFile = resolve(process.cwd(), process.env.KOISHI_CONFIG_FILE || 'koishi.config')
const configDir = dirname(configFile)

function isErrorModule (error: any) {
  return error.code !== 'MODULE_NOT_FOUND' || error.requireStack && error.requireStack[0] !== __filename
}

function tryCallback <T> (callback: () => T) {
  try {
    return callback()
  } catch (error) {
    if (isErrorModule(error) && error.code !== 'ENOENT') {
      throw error
    }
  }
}

const config: AppConfig | AppConfig[] = tryCallback(() => require(configFile))

if (!config) {
  throw new Error(`config file not found. use ${yellow('koishi init')} command to initialize a config file.`)
}

const cacheMap: Record<string, any> = {}

function loadEcosystem (type: string, name: string) {
  const cache = cacheMap[type + name]
  if (cache) return cache

  const modules = [resolve(configDir, name), name]
  const prefix = `koishi-${type}-`
  if (!name.includes(prefix)) {
    const index = name.lastIndexOf('/')
    modules.push(name.slice(0, index + 1) + prefix + name.slice(index + 1))
  }
  for (const name of modules) {
    logger.debug('resolving %c', name)
    try {
      return cacheMap[type + name] = require(name)
    } catch (error) {
      if (isErrorModule(error)) {
        throw error
      }
    }
  }
  throw new Error(`cannot resolve ${type} ${name}`)
}

function loadPlugins (ctx: Context, plugins: PluginConfig) {
  for (const item of plugins) {
    let plugin: Plugin<Context>, options: any
    if (Array.isArray(item)) {
      plugin = typeof item[0] === 'string' ? loadEcosystem('plugin', item[0]) : item[0]
      options = item[1]
    } else if (typeof item === 'string') {
      plugin = loadEcosystem('plugin', item)
    } else {
      plugin = item
    }
    ctx.plugin(plugin, options)
    if (plugin.name) logger.info('apply plugin %c', plugin.name)
  }
}

function prepareApp (config: AppConfig) {
  Object.assign(Logger.levels, config.logFilter)
  if (config.logLevel && !process.env.KOISHI_LOG_LEVEL) {
    Logger.baseLevel = config.logLevel
  }

  for (const name in config.database || {}) {
    const resolved = loadEcosystem('database', name)
    if (resolved) logger.info('apply database %c', name)
  }
  const app = new App(config)
  if (Array.isArray(config.plugins)) {
    loadPlugins(app, config.plugins)
  } else if (config.plugins && typeof config.plugins === 'object') {
    for (const path in config.plugins) {
      const ctx = app.createContext(path)
      loadPlugins(ctx, config.plugins[path])
    }
  }
}

if (Array.isArray(config)) {
  config.forEach(conf => prepareApp(conf))
} else {
  prepareApp(config)
}

onStart(() => {
  const versions = new Set<string>()
  const httpPorts = new Set<string>()
  const wsServers = new Set<string>()
  const httpServers = new Set<string>()
  appList.forEach((app) => {
    const { type, port, server } = app.options
    const { coolqEdition, pluginVersion } = app.version
    versions.add(`Koishi/${version} CoolQ/${capitalize(coolqEdition)} CQHTTP/${pluginVersion} `)
    if (type === 'http') {
      httpPorts.add(logger.format('server listening at %c', port))
      if (server) httpServers.add(logger.format('connected to %c', server))
    } else {
      wsServers.add(logger.format('connected to %c', server.replace(/^http/, 'ws')))
    }
  })
  for (const textSet of [versions, httpPorts, wsServers, httpServers]) {
    for (const text of textSet) {
      logger.info(text)
    }
  }
  const time = Math.max(0, performance.now() - +process.env.KOISHI_START_TIME).toFixed()
  logger.success(`bot started successfully in ${time} ms.`)
  process.send({ type: 'start' })
})

process.on('unhandledRejection', (error) => {
  logger.warn(format(error))
})

startAll().catch(handleException)
