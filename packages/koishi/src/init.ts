/* eslint-disable quote-props */

import { promises as fs, existsSync } from 'fs'
import { yellow, red, green, magenta } from 'kleur'
import { resolve, extname, dirname } from 'path'
import { spawn, StdioOptions } from 'child_process'
import { AppConfig } from '..'
import { CAC } from 'cac'
import prompts, { Choice, PromptObject } from 'prompts'
import * as mysql from 'koishi-plugin-mysql/dist/database'
import * as mongo from 'koishi-plugin-mongo/dist/database'

const serverQuestions: PromptObject<keyof AppConfig>[] = [{
  name: 'type',
  type: 'select',
  message: 'Server Type',
  choices: [
    { title: 'OneBot - HTTP', value: 'onebot:http' },
    { title: 'OneBot - WebSocket', value: 'onebot:ws' },
    { title: 'OneBot - WebSocket Reverse', value: 'onebot:ws-reverse' },
    // { title: 'Tomon', value: 'tomon' },
    { title: 'Telegram - HTTP', value: 'telegram' },
  ],
}, {
  name: 'port',
  type: 'number',
  message: 'Koishi Port',
  initial: 8080,
}]

const onebotQuestions: PromptObject[] = [{
  name: 'path',
  type: () => ['onebot:http', 'onebot:ws-reverse'].includes(config.type) ? 'text' : null,
  message: 'Koishi Path',
  initial: '/',
}, {
  name: 'server',
  type: () => ['onebot:http'].includes(config.type) ? 'text' : null,
  message: 'HTTP Server',
  initial: 'http://localhost:5700',
}, {
  name: 'server',
  type: () => ['onebot:ws'].includes(config.type) ? 'text' : null,
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
}]

const tomonQuestions: PromptObject[] = [{
  name: 'token',
  type: 'text',
  message: 'Token for Tomon',
}]

const telegramQuestions: PromptObject[] = [{
  name: 'token',
  type: 'text',
  message: 'Token for Telegram',
}, {
  name: 'selfUrl',
  type: 'text',
  message: 'Your Public URL',
}, {
  name: 'path',
  type: 'text',
  message: 'Telegram Path',
}]

const adapterMap = {
  'onebot:http': onebotQuestions,
  'onebot:ws': onebotQuestions,
  'onebot:ws-reverse': onebotQuestions,
  'tomon': tomonQuestions,
  'telegram': telegramQuestions,
}

const databaseQuestions: PromptObject<'database'>[] = [{
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

const databaseMap = {
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

const cwd = process.cwd()
const metaPath = resolve(cwd, 'package.json')
const ecosystem: Record<string, Package> = require('../ecosystem')
const builtinPackages = ['koishi-plugin-common']
const config: AppConfig = { plugins: {} }

async function createConfig() {
  Object.assign(config, await question(serverQuestions))
  Object.assign(config, await question(adapterMap[config.type]))

  // database
  const { database } = await question(databaseQuestions)
  if (database) {
    config.plugins[database] = await question(databaseMap[database])
  }

  // official plugins
  const choices: Choice[] = Object.entries(ecosystem).map(([title, meta]) => {
    if (!title.startsWith('koishi-plugin-')) return
    const value = title.slice(14)
    if (value in databaseMap) return
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

  for (const name of plugins) {
    config.plugins[name] = {}
  }
}

const sourceTypes = ['js', 'ts', 'json'] as const
type SourceType = typeof sourceTypes[number]

const error = red('error')
const success = green('success')
const info = magenta('info')

type Serializable = string | number | Serializable[] | { [key: string]: Serializable }

function joinLines(lines: string[], type: SourceType, indent: string) {
  if (!lines.length) return ''
  return `\n  ${indent}${lines.join(',\n  ' + indent)}${type === 'json' ? '' : ','}\n${indent}`
}

function codegen(value: Serializable, type: SourceType, indent = '') {
  if (value === null) return 'null'
  switch (typeof value) {
    case 'number': case 'boolean': return '' + value
    case 'string': return type === 'json' || value.includes("'") && !value.includes('"')
      ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
      : `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
    case 'undefined': return undefined
  }

  if (Array.isArray(value)) {
    return `[${joinLines(value.map(value => codegen(value, type, '  ' + indent)), type, indent)}]`
  }

  return `{${joinLines(Object.entries(value).filter(([, value]) => value !== undefined).map(([key, value]) => {
    const keyString = type === 'json' ? `"${key}"` : key
    const valueString = codegen(value, type, '  ' + indent)
    return keyString + ': ' + valueString
  }), type, indent)}}`
}

async function writeConfig(config: any, path: string, type: SourceType) {
  // generate output
  let output = codegen(config, type) + '\n'
  if (type === 'js') {
    output = 'module.exports = ' + output
  } else if (type === 'ts') {
    output = 'export = ' + output
  }

  // write to file
  const folder = dirname(path)
  await fs.mkdir(folder, { recursive: true })
  await fs.writeFile(path, output)
  console.log(`${success} created config file: ${path}`)
}

async function loadMeta() {
  return JSON.parse(await fs.readFile(metaPath, 'utf8')) as Package
}

function execute(bin: string, args: string[] = [], stdio: StdioOptions = 'inherit') {
  const child = spawn(bin, args, { stdio })
  return new Promise<number>((resolve) => {
    child.on('close', resolve)
  })
}

type Manager = 'yarn' | 'npm'

async function getManager(): Promise<Manager> {
  if (existsSync(resolve(cwd, 'yarn.lock'))) return 'yarn'
  if (existsSync(resolve(cwd, 'package-lock.json'))) return 'npm'
  if (!await execute('yarn', ['--version'], 'ignore')) return 'yarn'
  return 'npm'
}

// async jobs ahead of time
const _meta = loadMeta()
const _kind = getManager()

const installArgs: Record<Manager, string[]> = {
  yarn: [],
  npm: ['install', '--loglevel', 'error'],
}

async function updateMeta() {
  const meta = await _meta
  const kind = await _kind

  let modified = false
  if (!meta.dependencies) meta.dependencies = {}

  function ensureDependency(name: string) {
    if (meta.dependencies[name]) return
    modified = true
    meta.dependencies[name] = '^' + ecosystem[name].version
  }

  const [name] = config.type.split(':', 1)
  ensureDependency('koishi-adapter-' + name)
  for (const name of Object.keys(config.plugins)) {
    ensureDependency('koishi-plugin-' + name)
  }

  if (!modified) return
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2))
  console.log(`${success} package.json was updated`)

  const { confirm } = await question([{
    name: 'confirm',
    type: 'confirm',
    initial: true,
    message: 'package.json was updated. install new dependencies now?',
  }]).catch(() => ({ confirm: false }))

  const args = installArgs[kind]
  if (!confirm) {
    console.log(`${info} type "${[kind, ...args].join(' ')}" to install new dependencies before using koishi`)
    return
  }

  process.exit(await execute(kind, args))
}

export default function (cli: CAC) {
  cli.command('init [file]', 'initialize a koishi configuration file')
    .option('-f, --forced', 'overwrite config file if it exists')
    .action(async (file = 'koishi.config.js', options?) => {
      // resolve file path
      const path = resolve(cwd, file)
      if (!options.forced && existsSync(path)) {
        console.warn(`${error} configuration file already exists. If you want to overwrite the current file, use ${yellow('koishi init -f')}`)
        process.exit(1)
      }

      // parse extension
      const extension = extname(path).slice(1) as SourceType
      if (!extension) {
        console.warn(`${error} configuration file should have an extension, received "${file}"`)
        process.exit(1)
      } else if (!sourceTypes.includes(extension)) {
        console.warn(`${error} configuration file type "${extension}" is currently not supported`)
        process.exit(1)
      }

      // create configurations
      await createConfig().catch(() => {
        console.warn(`${error} initialization was canceled`)
        process.exit(0)
      })

      await writeConfig(config, path, extension)
      await updateMeta()
    })
}
