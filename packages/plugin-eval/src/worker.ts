import { defineProperty, Logger } from 'koishi-utils'
import { parentPort, workerData } from 'worker_threads'
import { InspectOptions, formatWithOptions } from 'util'
import { Session, User } from 'koishi-core'
import escapeRegExp from 'escape-string-regexp'

Logger.levels = workerData.logLevels

import { expose, Remote, status } from './comlink'
import { VM } from './vm'
import { MainAPI } from '.'

const { findSourceMap } = require('module')

export interface WorkerConfig {
  setupFiles?: Record<string, string>
  inspect?: InspectOptions
}

export const config: WorkerConfig = {
  ...workerData,
  inspect: {
    depth: 0,
    ...workerData.inspect,
  },
}

export default class Global {
  public user: User
  public session: Session
  private main: Remote<MainAPI>

  constructor () {
    for (const key of Object.getOwnPropertyNames(Global.prototype)) {
      if (key.startsWith('_') || key === 'constructor') continue
      this[key] = Global.prototype[key].bind(this)
    }
  }

  exec (message: string) {
    if (typeof message !== 'string') {
      throw new TypeError('The "message" argument must be of type string')
    }
    return this.main.execute(message)
  }

  log (format: string, ...param: any[]) {
    return this.main.send(formatWithOptions(config.inspect, format, ...param))
  }
}

interface EvalOptions {
  session: string
  user: string
  output: boolean
  source: string
}

export const sandbox = new Global()

const vm = new VM({ sandbox })

export const context = vm.context

type Bind <O, K extends keyof O> = O[K] extends (...args: infer R) => infer T ? (this: O, ...args: R) => T : O[K]

export function value <T> (value: T): T {
  return vm.internal.value(value)
}

export function setGlobal <K extends keyof Global> (key: K, value: Bind<Global, K>, writable = false) {
  if (typeof value === 'function') {
    value = value['bind'](sandbox)
  }
  vm.internal.setGlobal(key, value, writable)
}

const pathMapper: Record<string, RegExp> = {}

function formatError (error: Error) {
  if (!(error instanceof Error)) return `Uncaught: ${error}`

  if (error.name === 'SyntaxError') {
    const message = 'SyntaxError: ' + error.message
    const lines = error.stack.split('\n')
    const index = lines.indexOf(message) + 1
    if (lines[index].startsWith('    at new Script')) {
      return `${message}\n    at ${lines[0]}:${lines[2].length}`
    }
  }

  return error.stack.replace(/\s*.+Script[\s\S]*/, '').split('\n')
    .map((line) => {
      for (const name in pathMapper) {
        line = line.replace(pathMapper[name], '$1' + name)
      }
      return line
    })
    .join('\n')
}

export class WorkerAPI {
  async eval (options: EvalOptions, main: MainAPI) {
    const { session, source, user, output } = options
    defineProperty(sandbox, 'main', main)
    setGlobal('user', JSON.parse(user), true)
    setGlobal('session', JSON.parse(session), true)

    let result: any
    try {
      result = await vm.run(source, 'stdin')
    } catch (error) {
      return main.send(formatError(error))
    }

    if (result !== undefined && output) await sandbox.log(result)
  }
}

Promise.all(Object.values(config.setupFiles).map(file => require(file).default)).then(() => {
  status(parentPort)
  expose(new WorkerAPI(), parentPort)

  const path = findSourceMap(__filename).payload.sources[0].slice(7, -9)
  pathMapper['koishi/'] = new RegExp(`(at | \\()${escapeRegExp(path)}`, 'g')
  Object.entries(config.setupFiles).forEach(([name, path]) => {
    const sourceMap = findSourceMap(path)
    if (sourceMap) path = sourceMap.payload.sources[0].slice(7)
    return pathMapper[name] = new RegExp(`(at | \\()${escapeRegExp(path)}`, 'g')
  })
}, (err) => {
  status(parentPort, err instanceof Error ? err : new Error(err))
})
