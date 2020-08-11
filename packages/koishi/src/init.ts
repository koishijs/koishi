import { existsSync, writeFileSync, mkdirSync } from 'fs'
import { yellow, red, green } from 'kleur'
import { resolve, extname, dirname } from 'path'
import { AppConfig } from './worker'
import prompts from 'prompts'
import { CAC } from 'cac'

async function createConfig(options) {
  let succeed = true
  const data = await prompts([{
    name: 'type',
    type: 'select',
    message: 'Connection Type',
    choices: [
      { title: 'HTTP', value: 'http' },
      { title: 'WebSocket', value: 'ws' },
    ],
  }, {
    name: 'port',
    type: (_, data) => data.type === 'http' ? 'number' : null,
    message: 'Koishi Port',
    initial: 8080,
  }, {
    name: 'server',
    type: (_, data) => data.type === 'http' ? 'text' : null,
    message: 'HTTP Server',
    initial: 'http://localhost:5700',
  }, {
    name: 'server',
    type: (_, data) => data.type === 'ws' ? 'text' : null,
    message: 'WebSocket Server',
    initial: 'ws://localhost:6700',
  }, {
    name: 'selfId',
    type: 'number',
    message: 'Your Bot\'s QQ Number',
  }, {
    name: 'secret',
    type: 'text',
    message: 'Secret for Koishi Server',
  }, {
    name: 'token',
    type: 'text',
    message: 'Token for CoolQ Server',
  }], {
    onCancel: () => succeed = false,
  })
  if (!succeed) return
  const config = {} as AppConfig
  for (const key in data) {
    if (data[key]) config[key] = data[key]
  }
  config.plugins = ['common', 'schedule']
  return config
}

const supportedTypes = ['js', 'ts', 'json'] as const
type ConfigFileType = typeof supportedTypes[number]

export default function (cli: CAC) {
  const error = red('error')
  const success = green('success')

  cli.command('init [file]', 'initialize a koishi configuration file')
    .option('-f, --forced', 'overwrite config file if it exists')
    .action(async (file, options) => {
      // resolve file path
      const path = resolve(process.cwd(), String(file || 'koishi.config.js'))
      if (!options.forced && existsSync(path)) {
        console.warn(`${error} ${options.output} already exists. If you want to overwrite the current file, use ${yellow('koishi init -f')}`)
        process.exit(1)
      }

      // parse extension
      const extension = extname(path).slice(1) as ConfigFileType
      if (!extension) {
        console.warn(`${error} configuration file should have an extension, received "${file}"`)
        process.exit(1)
      } else if (!supportedTypes.includes(extension)) {
        console.warn(`${error} configuration file type "${extension}" is currently not supported`)
        process.exit(1)
      }

      // create configurations
      const config = await createConfig(options)
      if (!config) {
        console.warn(`${error} initialization was canceled`)
        process.exit(0)
      }

      // generate output
      let output = JSON.stringify(config, null, 2)
      if (extension !== 'json') {
        output = output.replace(/^(\s+)"([\w$]+)":/mg, '$1$2:')
        if (extension === 'js') {
          output = 'module.exports = ' + output
        } else if (extension === 'ts') {
          output = 'export = ' + output
        }
      }

      // write to file
      const folder = dirname(path)
      if (!existsSync(folder)) mkdirSync(folder, { recursive: true })
      writeFileSync(path, output)
      console.warn(`${success} created config file: ${path}`)
      process.exit(0)
    })
}
