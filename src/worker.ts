import { createApp, startAll, AppOptions, onStart, Context, eachApp } from 'koishi-core'
import { performance } from 'perf_hooks'
import { cyanBright } from 'chalk'
import { resolve } from 'path'
import { logger } from './utils'

process.on('uncaughtException', ({ message }) => {
  process.send({
    type: 'error',
    message,
  }, () => {
    process.exit(-1)
  })
})

const noModule = new Set<string>()

function loadFromModules (modules: string[], message: string) {
  for (const name of modules) {
    if (noModule.has(name)) continue
    try {
      return require(name)
    } catch (e) {
      noModule.add(name)
    }
  }
  throw new Error(message)
}

const base = process.env.KOISHI_BASE_PATH

function loadEcosystem (type: string, name: string) {
  let depName: string
  const prefix = `koishi-${type}-`
  if (name.includes(prefix)) {
    depName = name
  } else {
    const index = name.lastIndexOf('/')
    depName = name.slice(0, index + 1) + prefix + name.slice(index + 1)
  }
  return loadFromModules([
    depName,
    resolve(base, name),
  ], `cannot resolve ${type} ${name}`)
}

type PluginConfig = [Plugin, any][]

interface AppConfig extends AppOptions {
  plugins?: PluginConfig | Record<string, PluginConfig>
}

function loadPlugins (ctx: Context, plugins: PluginConfig) {
  for (const [plugin, options] of plugins) {
    const resolved = typeof plugin === 'string' ? loadEcosystem('plugin', plugin) : plugin
    ctx.plugin(resolved, options)
    if (resolved.name) logger.info(`apply plugin ${cyanBright(resolved.name)}`)
  }
}

function prepareApp (config: AppConfig) {
  for (const name in config.database || {}) {
    const resolved = loadEcosystem('database', name)
    if (resolved) logger.info(`apply database ${cyanBright(name)}`)
  }
  const app = createApp(config)
  if (Array.isArray(config.plugins)) {
    loadPlugins(app, config.plugins)
  } else if (config.plugins && typeof config.plugins === 'object') {
    for (const path in config.plugins) {
      const capture = /^\/(?:(user|discuss|group)\/(?:(\d+)\/)?)?$/.exec(path)
      if (!path) {
        logger.warning(`invalid context path: ${path}.`)
        continue
      }
      const ctx = app._createContext(path, +capture[2])
      loadPlugins(ctx, config.plugins[path])
    }
  }
}

const config: AppConfig | AppConfig[] = loadFromModules([
  resolve(base, 'koishi.config'),
  base,
], `config file not found.`)

if (Array.isArray(config)) {
  config.forEach(conf => prepareApp(conf))
} else {
  prepareApp(config)
}

onStart(() => {
  const time = Math.max(0, performance.now() - +process.env.KOISHI_START_TIME).toFixed()
  logger.success(`bot started successfully in ${time} ms`)
  process.send({
    type: 'start',
  })
})

eachApp((app) => {
  app.receiver.on('warning', (error) => {
    logger.warning(`${error}`)
  })
})

startAll().catch((error) => {
  logger.error(error.message)
  process.exit(-1)
})
