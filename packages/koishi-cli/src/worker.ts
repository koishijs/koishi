import { App, AppOptions, Context, Plugin, appList, startAll, onStart } from 'koishi-core'
import { resolve, extname, dirname } from 'path'
import { capitalize } from 'koishi-utils'
import { performance } from 'perf_hooks'
import { cyan, yellow } from 'kleur'
import { logger } from './utils'
import { format } from 'util'
import { readFileSync } from 'fs'
import { safeLoad } from 'js-yaml'

const { version } = require('../package')

let baseLogLevel = 3
if (process.env.KOISHI_LOG_LEVEL !== undefined) {
  baseLogLevel = +process.env.KOISHI_LOG_LEVEL
}

function handleException (error: any) {
  logger.error(error, baseLogLevel)
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
const extension = extname(configFile)
const configDir = dirname(configFile)
let config: AppConfig | AppConfig[]

function tryCallback <T> (callback: () => T) {
  try {
    return callback()
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND' && error.code !== 'ENOENT') {
      throw error
    }
  }
}

if (['.js', '.json', '.ts'].includes(extension)) {
  config = tryCallback(() => require(configFile))
} else if (['.yaml', '.yml'].includes(extension)) {
  config = tryCallback(() => safeLoad(readFileSync(configFile, 'utf8')))
} else {
  config = tryCallback(() => require(configFile))
    || tryCallback(() => safeLoad(readFileSync(configFile + '.yml', 'utf8')))
    || tryCallback(() => safeLoad(readFileSync(configFile + '.yaml', 'utf8')))
}

if (!config) {
  throw new Error(`config file not found. use ${yellow('koishi init')} command to initialize a config file.`)
}

function loadEcosystem (type: string, name: string) {
  const modules = [resolve(configDir, name)]
  const prefix = `koishi-${type}-`
  if (name.includes(prefix)) {
    modules.push(name)
  } else {
    const index = name.lastIndexOf('/')
    modules.push(name.slice(0, index + 1) + prefix + name.slice(index + 1))
  }
  for (const name of modules) {
    try {
      return require(name)
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') {
        throw error
      }
    }
  }
  throw new Error(`cannot resolve ${type} ${name}`)
}

function loadPlugins (ctx: Context, plugins: PluginConfig) {
  for (const item of plugins) {
    let plugin: Plugin<Context>, options
    if (Array.isArray(item)) {
      plugin = typeof item[0] === 'string' ? loadEcosystem('plugin', item[0]) : item[0]
      options = item[1]
    } else if (typeof item === 'string') {
      plugin = loadEcosystem('plugin', item)
    } else {
      plugin = item
    }
    ctx.plugin(plugin, options)
    if (plugin.name) logger.info(`apply plugin ${cyan(plugin.name)}`, baseLogLevel)
  }
}

function prepareApp (config: AppConfig) {
  for (const name in config.database || {}) {
    const resolved = loadEcosystem('database', name)
    if (resolved) logger.info(`apply database ${cyan(name)}`, baseLogLevel)
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
      httpPorts.add(`server listening at ${cyan(port)}`)
      if (server) httpServers.add(`connected to ${cyan(server)}`)
    } else {
      wsServers.add(`connected to ${cyan(server.replace(/^http/, 'ws'))}`)
    }
  })
  for (const textSet of [versions, httpPorts, wsServers, httpServers]) {
    for (const text of textSet) {
      logger.info(text, baseLogLevel)
    }
  }
  const time = Math.max(0, performance.now() - +process.env.KOISHI_START_TIME).toFixed()
  logger.success(`bot started successfully in ${time} ms.`, baseLogLevel)
  process.send({ type: 'start' })
})

process.on('unhandledRejection', (error) => {
  logger.warn(format(error), baseLogLevel)
})

appList.forEach((app) => {
  const { logLevel = 2, logFilter = {} } = app.options as AppConfig

  app.on('logger', (scope, message, type) => {
    logger[type](message, Math.min(logFilter[scope] ?? logLevel, baseLogLevel), scope)
  })
})

startAll().catch(handleException)
