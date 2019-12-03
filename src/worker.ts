import { createApp, startAll, AppOptions, onStart } from 'koishi-core'
import { resolve } from 'path'
import { black } from 'chalk'

export function loadFromModules (modules: string[], callback: () => void) {
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

function prepareApp (config: AppOptions) {
  for (const name in config.database || {}) {
    loadEcosystem('database', name)
  }
  for (const plugin of config.plugins || []) {
    if (typeof plugin[0] === 'string') {
      plugin[0] = loadEcosystem('plugin', plugin[0])
    }
  }
  createApp(config)
}

const config: AppOptions | AppOptions[] = loadFromModules([
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
})

startAll()
