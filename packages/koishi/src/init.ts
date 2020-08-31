import { promises as fs, existsSync } from 'fs'
import { yellow, red, green } from 'kleur'
import { resolve, extname, dirname } from 'path'
import { AppConfig } from './worker'
import { CAC } from 'cac'
import prompts, { Choice, PrevCaller, PromptObject } from 'prompts'
import * as mysql from 'koishi-plugin-mysql'
import * as mongo from 'koishi-plugin-mongo'

function conditional<T extends PromptObject['type']>(type: T, key: string, ...values: string[]): PrevCaller<any> {
  return (prev, data, prompt) => {
    if (!values.includes(data[key])) return null
    return typeof type === 'function' ? (type as PrevCaller<any>)(prev, data, prompt) : type
  }
}

const serverQuestions: PromptObject<keyof AppConfig | 'database'>[] = [{
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

const dbQuestionMap = {
  mysql: mysqlQuestions,
  mongo: mongoQuestions,
}

async function question<T extends string>(questions: PromptObject<T>[]) {
  let succeed = true
  const data = await prompts(questions, {
    onCancel: () => succeed = false,
  })
  if (!succeed) throw new Error('interrupted')
  return data
}

type DependencyType = 'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies'

interface Package extends Partial<Record<DependencyType, Record<string, string>>> {
  version: string
  description?: string
}

const ecosystem: Record<string, Package> = require('../ecosystem')
const builtinPackages = ['koishi-plugin-common']

async function createConfig() {
  const data = await question(serverQuestions)
  const { database } = data
  const config = { ...data, database: undefined, plugins: [] } as AppConfig

  // database
  if (database) {
    config.plugins.push([database, await question(dbQuestionMap[database])])
  }

  // official plugins
  const choices: Choice[] = Object.entries(ecosystem).map(([title, meta]) => {
    if (!title.startsWith('koishi-plugin-')) return
    const value = title.slice(14)
    if (value in dbQuestionMap) return
    const { description } = meta
    const selected = builtinPackages.includes(title)
    return { title, value, description, selected }
  }).filter(Boolean)

  const { plugins } = await prompts({
    type: 'multiselect',
    name: 'plugins',
    message: 'Choose Official Plugins',
    choices,
  })

  config.plugins.push(...plugins.map(name => [name]))

  return config
}

const workingDirectory = process.cwd()
const supportedTypes = ['js', 'ts', 'json'] as const
type ConfigFileType = typeof supportedTypes[number]

const error = red('error')
const success = green('success')

async function updateMeta(config: AppConfig) {
  const path = resolve(workingDirectory, 'package.json')
  const meta: Package = JSON.parse(await fs.readFile(path, 'utf8'))
  let modified = false
  if (!meta.dependencies) meta.dependencies = {}
  for (const [name] of config.plugins as string[]) {
    const fullname = 'koishi-plugin-' + name
    if (!meta.dependencies[fullname]) {
      modified = true
      meta.dependencies[fullname] = ecosystem[fullname].version
    }
  }
  if (!modified) return
  await fs.writeFile(path, JSON.stringify(meta, null, 2))
  console.log(`${success} package.json was updated`)
}

async function writeConfig(config: AppConfig, path: string, type: ConfigFileType) {
  // generate output
  let output = JSON.stringify(config, null, 2)
  if (type !== 'json') {
    output = output.replace(/^(\s+)"([\w$]+)":/mg, '$1$2:')
    if (type === 'js') {
      output = 'module.exports = ' + output
    } else if (type === 'ts') {
      output = 'export = ' + output
    }
  }

  // write to file
  const folder = dirname(path)
  await fs.mkdir(folder, { recursive: true })
  await fs.writeFile(path, output)
  console.log(`${success} created config file: ${path}`)
}

export default function (cli: CAC) {
  cli.command('init [file]', 'initialize a koishi configuration file')
    .option('-f, --forced', 'overwrite config file if it exists')
    .action(async (file = 'koishi.config.js', options) => {
      // resolve file path
      const path = resolve(workingDirectory, file)
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

      await Promise.all([updateMeta(config), writeConfig(config, path, extension)])
      process.exit(0)
    })
}
