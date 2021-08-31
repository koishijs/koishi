import { Channel, User, Logger, escapeRegExp, observe, difference, Time, segment, Random, Awaitable, Dict } from 'koishi'
import { parentPort, workerData } from 'worker_threads'
import { InspectOptions, formatWithOptions } from 'util'
import { findSourceMap } from 'module'
import { resolve, dirname, sep } from 'path'

/* eslint-disable import/first */

// time diff is not displayed because timestamp will not be synchronized between main thread and worker thread
Logger.levels = workerData.logLevels
Logger.showTime = workerData.logTime
const logger = new Logger('eval')

export const config: WorkerData = {
  ...workerData,
  inspect: {
    depth: 0,
    ...workerData.inspect,
  },
}

import prepare, { synthetize, LoaderConfig, system } from './loader'
import { expose, wrap } from '../transfer'
import { Sandbox } from './sandbox'
import { MainHandle } from '..'

export * from './loader'

export interface WorkerConfig {
  root?: string
  serializer?: 'yaml' | 'v8'
  moduleLoaders?: Dict<string>
  inspect?: InspectOptions
  cacheFile?: string
  storageFile?: string
  setupFiles?: Dict<string>
  loaderConfig?: LoaderConfig
}

export interface WorkerData extends WorkerConfig {
  addonNames?: string[]
}

interface EvalOptions {
  silent: boolean
  source: string
}

const vm = new Sandbox()
export const context = vm.context
export const internal = vm.internal

const pathMapper: Dict<RegExp> = {}

function formatResult(...param: [string, ...any[]]) {
  return formatWithOptions(config.inspect, ...param)
}

export function formatError(error: Error) {
  if (!(error instanceof Error)) return `Uncaught: ${error}`

  return error.stack
    .replace(/\s*.+(Script|MessagePort)[\s\S]*/, '')
    .split('\n')
    .map((line) => {
      for (const name in pathMapper) {
        line = line.replace(pathMapper[name], '$1' + name)
      }
      return line
    })
    .join('\n')
}

export const main = wrap<MainHandle>(parentPort)

export interface SessionData {
  id: string
  user: Partial<User>
  channel: Partial<Channel>
  userWritable: User.Field[]
  channelWritable: Channel.Field[]
}

type Serializable = string | number | boolean | Serializable[] | SerializableObject
type SerializableObject = { [K in string]: Serializable }

export interface Session {
  storage: SerializableObject
  user: User.Observed<any>
  channel: Channel.Observed<any>
  send(...param: any[]): Promise<void>
  exec(message: string): Promise<string>
}

let storage: SerializableObject
let backupStorage: Buffer
const storagePath = resolve(config.root || process.cwd(), config.storageFile || '.koishi/storage')

export const createSession = ({ id, user, userWritable, channel, channelWritable }: SessionData): Session => ({
  storage,

  user: user && observe(user, async (diff) => {
    const diffKeys = difference(Object.keys(diff), userWritable)
    if (diffKeys.length) {
      throw new TypeError(`cannot set user field: ${diffKeys.join(', ')}`)
    }
    await main.updateUser(id, diff)
  }),

  channel: channel && observe(channel, async (diff) => {
    const diffKeys = difference(Object.keys(diff), channelWritable)
    if (diffKeys.length) {
      throw new TypeError(`cannot set group field: ${diffKeys.join(', ')}`)
    }
    await main.updateGroup(id, diff)
  }),

  async send(...param: [string, ...any[]]) {
    const content = formatResult(...param)
    if (!content) return
    return await main.send(id, content)
  },

  async exec(message: string) {
    if (typeof message !== 'string') {
      throw new TypeError('The "message" argument must be of type string')
    }
    return await main.execute(id, message)
  },
})

export interface WorkerResponse {
  commands?: string[]
}

export const response: WorkerResponse = {}

interface AddonArgv {
  name: string
  args: string[]
  options: Dict<any>
}

interface AddonScope extends AddonArgv, Session {}

type AddonAction = (scope: AddonScope) => Awaitable<string | void>
const commandMap: Dict<AddonAction> = {}

export class WorkerHandle {
  start() {
    return response
  }

  async sync(scope: Session) {
    await scope.user?.$update()
    await scope.channel?.$update()
    try {
      const buffer = system.serialize(scope.storage)
      await system.write(storagePath, backupStorage = buffer)
    } catch (error) {
      storage = system.deserialize(backupStorage)
      throw error
    }
  }

  async eval(data: SessionData, options: EvalOptions) {
    const { source, silent } = options

    const key = 'koishi-eval-context:' + data.id
    const scope = createSession(data)
    internal.setGlobal(Symbol.for(key), scope, true)

    let result: any
    try {
      result = await vm.run(`with (global[Symbol.for("${key}")]) {
        delete global[Symbol.for("${key}")];\n${source}
      }`, {
        filename: 'stdin',
        lineOffset: -2,
      })
      await this.sync(scope)
    } catch (error) {
      return formatError(error)
    }

    if (result === undefined || silent) return
    return formatResult(result)
  }

  async callAddon(options: SessionData, argv: AddonArgv) {
    const callback = commandMap[argv.name]
    try {
      const ctx = { ...argv, ...createSession(options) }
      const result = await callback(ctx)
      await this.sync(ctx)
      return result
    } catch (error) {
      if (!argv.options.debug) return logger.warn(error)
      return formatError(error)
    }
  }
}

synthetize('koishi/addons.ts', {
  registerCommand(name: string, callback: AddonAction) {
    commandMap[name] = callback
  },
})

synthetize('koishi/utils.ts', {
  Time, segment, Random,
}, 'utils')

export function mapDirectory(identifier: string, filename: string) {
  const sourceMap = findSourceMap(filename)
  if (!sourceMap) return logger.debug('cannot find source map for %c', filename)
  const path = dirname(sourceMap.payload.sources[0].slice(7)) + sep
  pathMapper[identifier] = new RegExp(`(at | \\()${escapeRegExp(path)}`, 'g')
}

Object.values(config.setupFiles).map(require)

async function start() {
  const [data] = await Promise.all([system.read(storagePath), prepare()])
  if (data) {
    storage = data[0]
    backupStorage = data[1]
  } else {
    storage = {}
    backupStorage = system.serialize({})
  }

  response.commands = Object.keys(commandMap)
  mapDirectory('koishi/utils/', require.resolve('@koishijs/utils'))
  mapDirectory('koishi/', __filename)
  Object.entries(config.setupFiles).forEach(([name, path]) => {
    const sourceMap = findSourceMap(path)
    if (sourceMap) path = sourceMap.payload.sources[0].slice(7)
    return pathMapper[name] = new RegExp(`(at | \\()${escapeRegExp(path)}`, 'g')
  })
  expose(parentPort, new WorkerHandle())
}

start()
