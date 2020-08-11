import { defineProperty, Logger } from 'koishi-utils'
import { parentPort, workerData } from 'worker_threads'
import { InspectOptions, formatWithOptions } from 'util'
import { Session, User } from 'koishi-core'
import escapeRegExp from 'escape-string-regexp'

/* eslint-disable import/first */

Logger.levels = workerData.logLevels
const logger = Logger.create('eval')

import { expose, Remote } from './comlink'
import { VM } from './vm'
import { MainAPI } from '.'

const { findSourceMap } = require('module')

export interface WorkerConfig {
  setupFiles?: Record<string, string>
  inspect?: InspectOptions
}

export interface WorkerData extends WorkerConfig {}

export const config: WorkerData = {
  ...workerData,
  inspect: {
    depth: 0,
    ...workerData.inspect,
  },
}

export interface Global {
  user: User
  session: Session
  exec (message: string): Promise<void>
  log (format: string, ...param: any[]): Promise<void>
}

interface EvalOptions {
  session: string
  user: string
  output: boolean
  source: string
}

const vm = new VM()
export const context = vm.context
export const internal = vm.internal
export const sandbox = internal.sandbox

const pathMapper: Record<string, RegExp> = {}

function formatError(error: Error) {
  if (!(error instanceof Error)) return `Uncaught: ${error}`

  if (error.name === 'SyntaxError') {
    // syntax error during compilation
    const message = 'SyntaxError: ' + error.message
    const lines = error.stack.split('\n')
    const index = lines.indexOf(message) + 1
    if (lines[index].startsWith('    at new Script')) {
      return `${message}\n    at ${lines[0]}:${lines[2].length}`
    }
  }

  return error.stack
    .replace(/\s*.+Script[\s\S]*/, '')
    .split('\n')
    .map((line) => {
      for (const name in pathMapper) {
        line = line.replace(pathMapper[name], '$1' + name)
      }
      return line
    })
    .join('\n')
}

export class WorkerAPI {
  main: Remote<MainAPI>

  constructor() {
    const self = this

    internal.setGlobal('exec', function exec(message: string) {
      if (typeof message !== 'string') {
        throw new TypeError('The "message" argument must be of type string')
      }
      return self.main.execute(message)
    })

    internal.setGlobal('log', function log(format: string, ...param: any[]) {
      return self.main.send(formatWithOptions(config.inspect, format, ...param))
    })
  }

  async eval(options: EvalOptions, main: MainAPI) {
    const { session, source, user, output } = options
    defineProperty(this, 'main', main)
    internal.setGlobal('user', JSON.parse(user), true)
    internal.setGlobal('session', JSON.parse(session), true)

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
  expose(new WorkerAPI(), parentPort)

  const path = findSourceMap(__filename).payload.sources[0].slice(7, -9)
  pathMapper['koishi/'] = new RegExp(`(at | \\()${escapeRegExp(path)}`, 'g')
  Object.entries(config.setupFiles).forEach(([name, path]) => {
    const sourceMap = findSourceMap(path)
    if (sourceMap) path = sourceMap.payload.sources[0].slice(7)
    return pathMapper[name] = new RegExp(`(at | \\()${escapeRegExp(path)}`, 'g')
  })
}, logger.warn)
