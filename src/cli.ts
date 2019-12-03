#!/usr/bin/env node

import { createApp, startAll, AppOptions, onStart } from 'koishi-core'
import { existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { black } from 'chalk'
import CAC from 'cac'

const { version } = require('../package')
const cli = CAC('koishi').help().version(version)
const cwd = process.cwd()

cli.command('init')
  .option('-f, --forced', 'overwrite config file if it exists')
  .option('-o, --output <file>', 'path of output file', { default: 'koishi.config.js' })
  .option('-p, --port <port>', 'port number', { default: 8080 })
  .option('-s, --secret [secret]', 'secret for koishi server')
  .option('-t, --token [token]', 'token for CoolQ server')
  .option('-u, --url <url>', 'CoolQ server url', { default: 'http://localhost:5700' })
  .action(function (options) {
    const path = resolve(cwd, '' + options.output)
    if (!options.forced && existsSync(path)) {
      console.log(`${black.bgRedBright(' ERROR ')} ${options.output} already exists.`)
      process.exit(1)
    }
    const output: string[] = ['module.exports = {']
    output.push(`  port: ${JSON.stringify(options.port)},`)
    output.push(`  sendUrl: ${JSON.stringify(options.url)},`)
    if (options.secret) output.push(`  secret: ${JSON.stringify(options.secret)},`)
    if (options.token) output.push(`  token: ${JSON.stringify(options.token)},`)
    output.push(`  plugins: [`)
    output.push(`    ['common'],`)
    output.push(`  ],`)
    output.push('}\n')
    writeFileSync(path, output.join('\n'))
    console.log(`${black.bgGreenBright(' SUCCESS ')} created config file: ${path}.`)
    process.exit(0)
  })

const options = cli.parse()

if (!options.args.length) {
  cli.outputHelp()
  process.exit(0)
}

const [target] = options.args
const baseFolder = resolve(cwd, '' + target)

function loadFromModules (modules: string[], callback: () => void) {
  for (const name of modules) {
    try {
      return require(name)
    } catch (e) {}
  }
  callback()
}

const config: AppOptions | AppOptions[] = loadFromModules([
  resolve(baseFolder, 'koishi.config.js'),
  baseFolder,
], () => {
  console.log(`${black.bgRedBright(' ERROR ')} config file not found.`)
  process.exit(1)
})

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
    resolve(baseFolder, name),
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

if (Array.isArray(config)) {
  config.forEach(prepareApp)
} else {
  prepareApp(config)
}

onStart(() => {
  console.log(`${black.bgGreenBright(' SUCCESS ')} Bot has started successfully.`)
})

startAll()
