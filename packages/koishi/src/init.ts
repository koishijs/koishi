import { existsSync, writeFileSync, mkdirSync } from 'fs'
import { yellow, red, green } from 'kleur'
import { resolve, extname, dirname } from 'path'
import { AppConfig } from './worker'
import prompts, { PrevCaller, PromptObject } from 'prompts'
import { CAC } from 'cac'
import { AppOptions } from 'koishi-core'
import { omit } from 'koishi-utils'
import * as mysql from 'koishi-plugin-mysql'
import * as mongo from 'koishi-plugin-mongo'

function conditional<T extends PromptObject['type']>(type: T, key: string, ...values: string[]): PrevCaller<any> {
  return (prev, data, prompt) => {
    if (!values.includes(data[key])) return null
    return typeof type === 'function' ? (type as PrevCaller<any>)(prev, data, prompt) : type
  }
}

const serverQuestions: PromptObject<keyof AppOptions | 'database'>[] = [{
  name: 'type',
  type: 'select',
  message: 'Server Type',
  choices: [
    { title: 'HTTP', value: 'cqhttp:http' },
    { title: 'WebSocket', value: 'cqhttp:ws' },
    { title: 'WebSocket Reverse', value: 'cqhttp:ws-reverse' },
  ],
}, {
  name: 'port',
  type: conditional('number', 'type', 'cqhttp:http', 'cqhttp:ws-reverse'),
  message: 'Koishi Port',
  initial: 8080,
}, {
  name: 'path',
  type: conditional('text', 'type', 'cqhttp:http', 'cqhttp:ws-reverse'),
  message: 'Koishi Path',
  initial: '/',
}, {
  name: 'server',
  type: conditional('text', 'type', 'cqhttp:http'),
  message: 'HTTP Server',
  initial: 'http://localhost:5700',
}, {
  name: 'server',
  type: conditional('text', 'type', 'cqhttp:ws'),
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
  message: 'Token for CQHTTP Server',
}, {
  name: 'database',
  type: 'select',
  message: 'Database Type',
  choices: [
    { title: 'None', value: null },
    { title: 'MySQL', value: 'mysql' },
    { title: 'MongoDB', value: 'mongo' },
  ],
}]

const mysqlQuestions: PromptObject<keyof mysql.Config>[] = [{
  name: 'host',
  type: 'text',
  message: 'MySQL / Host',
  initial: '127.0.0.1',
}, {
  name: 'port',
  type: 'number',
  message: 'MySQL / Port',
  initial: '3306',
}, {
  name: 'user',
  type: 'text',
  message: 'MySQL / Username',
  initial: 'root',
}, {
  name: 'password',
  type: 'text',
  message: 'MySQL / Password',
}, {
  name: 'database',
  type: 'text',
  message: 'MySQL / Database',
  initial: 'koishi',
}]

const mongoQuestions: PromptObject<keyof mongo.Config>[] = [{
  name: 'host',
  type: 'text',
  message: 'MongoDB / Host',
  initial: '127.0.0.1',
}, {
  name: 'port',
  type: 'number',
  message: 'MongoDB / Port',
  initial: '27017',
}, {
  name: 'username',
  type: 'text',
  message: 'MongoDB / Username',
  initial: 'root',
}, {
  name: 'password',
  type: 'text',
  message: 'MongoDB / Password',
}, {
  name: 'name',
  type: 'text',
  message: 'MongoDB / Database',
  initial: 'koishi',
}]

async function question<T extends string>(questions: PromptObject<T>[]) {
  let succeed = true
  const data = await prompts(questions, {
    onCancel: () => succeed = false,
  })
  if (!succeed) throw new Error('interrupted')
  return data
}

async function createConfig() {
  const data = await question(serverQuestions)
  const config = omit(data, ['database']) as AppConfig
  config.plugins = []
  console.log(data.database)
  if (data.database === 'mysql') {
    config.plugins.push(['mysql', await question(mysqlQuestions)])
  } else if (data.database === 'mongo') {
    config.plugins.push(['mongo', await question(mongoQuestions)])
  }
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
      const config = await createConfig().catch(() => {})
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
