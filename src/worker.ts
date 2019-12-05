import { createApp, startAll, AppOptions, onStart, Context } from 'koishi-core'
import { resolve } from 'path'
import { black } from 'chalk'

function loadFromModules (modules: string[], callback: () => void) {
  for (const name of modules) {
    try {
      return require(name)
    } catch (e) {}
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
    console.log(`${black.bgYellowBright(' WARNING ')} cannot resolve ${type} ${name}`)
  })
}

type PluginConfig = [Plugin, any][]

interface AppConfig extends AppOptions {
  plugins?: PluginConfig | Record<string, PluginConfig>
}

function loadPlugins (ctx: Context, plugins: PluginConfig) {
  for (const [plugin, options] of plugins) {
    ctx.plugin(typeof plugin === 'string' ? loadEcosystem('plugin', plugin) : plugin, options)
  }
}

function prepareApp (config: AppConfig) {
  for (const name in config.database || {}) {
    loadEcosystem('database', name)
  }
  const app = createApp(config)
  if (Array.isArray(config.plugins)) {
    loadPlugins(app, config.plugins)
  } else if (config.plugins && typeof config.plugins === 'object') {
    for (const path in config.plugins) {
      const capture = /^\/(?:(user|discuss|group)\/(?:(\d+)\/)?)?$/.exec(path)
      if (!path) {
        console.log(`${black.bgRedBright(' WARNING ')} invalid context path: ${path}.`)
        continue
      }
      const ctx = app._createContext(path, +capture[2])
      loadPlugins(ctx, config.plugins[path])
    }
  }
}

const config: AppConfig | AppConfig[] = loadFromModules([
  resolve(base, 'koishi.config.js'),
  base,
], () => {
  console.log(`${black.bgRedBright('  ERROR  ')} config file not found.`)
  process.exit(1)
})

if (Array.isArray(config)) {
  config.forEach(conf => prepareApp(conf))
} else {
  prepareApp(config)
}

onStart(() => {
  console.log(`${black.bgGreenBright(' SUCCESS ')} Bot has started successfully.`)
  process.send('started')
})

startAll()
