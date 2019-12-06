import { createApp, startAll, AppOptions, onStart, Context, eachApp } from 'koishi-core'
import { performance } from 'perf_hooks'
import { resolve } from 'path'
import { black } from 'chalk'

const noModule = new Set<string>()

function loadFromModules (modules: string[], callback: () => void) {
  for (const name of modules) {
    if (noModule.has(name)) continue
    try {
      return require(name)
    } catch (e) {
      noModule.add(name)
    }
  }
  callback()
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
  ], () => {
    console.log(`${black.bgRedBright(' ERROR ')} cannot resolve ${type} ${name}`)
    process.exit(1)
  })
}

type PluginConfig = [Plugin, any][]

interface AppConfig extends AppOptions {
  plugins?: PluginConfig | Record<string, PluginConfig>
}

function loadPlugins (ctx: Context, plugins: PluginConfig) {
  for (const [plugin, options] of plugins) {
    const resolved = typeof plugin === 'string' ? loadEcosystem('plugin', plugin) : plugin
    ctx.plugin(resolved, options)
    if (resolved.name) console.log(`${black.bgCyanBright(' INFO ')} apply plugin ${resolved.name}`)
  }
}

function prepareApp (config: AppConfig) {
  for (const name in config.database || {}) {
    const resolved = loadEcosystem('database', name)
    if (resolved) console.log(`${black.bgCyanBright(' INFO ')} apply database ${name}`)
  }
  const app = createApp(config)
  if (Array.isArray(config.plugins)) {
    loadPlugins(app, config.plugins)
  } else if (config.plugins && typeof config.plugins === 'object') {
    for (const path in config.plugins) {
      const capture = /^\/(?:(user|discuss|group)\/(?:(\d+)\/)?)?$/.exec(path)
      if (!path) {
        console.log(`${black.bgYellowBright(' WARNING ')} invalid context path: ${path}.`)
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
], () => {
  console.log(`${black.bgRedBright(' ERROR ')} config file not found.`)
  process.exit(1)
})

if (Array.isArray(config)) {
  config.forEach(conf => prepareApp(conf))
} else {
  prepareApp(config)
}

onStart(() => {
  const time = (performance.now() - +process.env.KOISHI_START_TIME).toFixed()
  console.log(`${black.bgGreenBright(' SUCCESS ')} bot started successfully in ${time} ms`)
  process.send('started')
})

eachApp((app) => {
  app.receiver.on('warning', (error) => {
    console.log(`${black.bgYellowBright(' WARNING ')} ${error}`)
  })
})

startAll()

process.on('uncaughtException', (error) => {
  console.log(`${black.bgYellowBright(' ERROR ')} ${error}`)
  process.exit(1)
})
