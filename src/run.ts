import { createApp, startAll, AppOptions, onStart } from 'koishi-core'
import { resolve } from 'path'
import { black } from 'chalk'
import CAC from 'cac/types/CAC'

function loadFromModules (modules: string[], callback: () => void) {
  for (const name of modules) {
    try {
      return require(name)
    } catch (e) {}
  }
  callback()
}

function loadEcosystem (baseFolder: string, type: string, name: string) {
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
    resolve(baseFolder, name),
  ], () => {
    console.log(`${black.bgYellowBright(' WARNING ')} cannot resolve ${type} ${name}`)
  })
}

function prepareApp (baseFolder: string, config: AppOptions) {
  for (const name in config.database || {}) {
    loadEcosystem(baseFolder, 'database', name)
  }
  for (const plugin of config.plugins || []) {
    if (typeof plugin[0] === 'string') {
      plugin[0] = loadEcosystem(baseFolder, 'plugin', plugin[0])
    }
  }
  createApp(config)
}

export default function (cli: CAC) {
  cli.command('run [file]', 'start a koishi bot')
    .alias('start')
    .action((file, options) => {
      const baseFolder = resolve(process.cwd(), '' + (file || ''))

      const config: AppOptions | AppOptions[] = loadFromModules([
        resolve(baseFolder, 'koishi.config.js'),
        baseFolder,
      ], () => {
        console.log(`${black.bgRedBright(' ERROR ')} config file not found.`)
        process.exit(1)
      })

      if (Array.isArray(config)) {
        config.forEach(conf => prepareApp(baseFolder, conf))
      } else {
        prepareApp(baseFolder, config)
      }

      onStart(() => {
        console.log(`${black.bgGreenBright(' SUCCESS ')} Bot has started successfully.`)
      })

      startAll()
    })
}
