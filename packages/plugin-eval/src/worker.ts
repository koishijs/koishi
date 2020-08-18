import { defineProperty, Logger } from 'koishi-utils'
import { parentPort, workerData } from 'worker_threads'
import { InspectOptions, formatWithOptions } from 'util'
import { Session, User } from 'koishi-core'
import escapeRegExp from 'escape-string-regexp'

/* eslint-disable import/first */

Logger.levels = workerData.logLevels
const logger = Logger.create('eval')

import { expose, Remote, wrap } from './transfer'
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
  sid: string
  user: {}
  silent: boolean
  source: string
}

const vm = new VM()
export const context = vm.context
export const internal = vm.internal
export const sandbox: Global = internal.sandbox

const pathMapper: Record<string, RegExp> = {}

function formatResult(...param: [string, ...any[]]) {
  return formatWithOptions(config.inspect, ...param)
}

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

const main = wrap<MainAPI>(parentPort)

export class WorkerAPI {
  start() {}

  async eval(options: EvalOptions) {
    console.log('worker eval')
    const { sid, source, user, silent } = options

    internal.setGlobal('temp', {
      user,
      async send(...param: [string, ...any[]]) {
        return await main.send(sid, formatResult(...param))
      },
      async execute(message: string) {
        if (typeof message !== 'string') {
          throw new TypeError('The "message" argument must be of type string')
        }
        return await main.execute(sid, message)
      },
    }, true)

    let result: any
    try {
      console.log('run')
      result = await vm.run(`{
        const { send, execute, user } = temp;
        delete temp;
        ${source}
      }`, 'stdin')
    } catch (error) {
      return formatError(error)
    }

    if (result === undefined || silent) return
    return formatResult(result)
  }
}

Promise.all(Object.values(config.setupFiles).map(file => require(file).default)).then(() => {
  const path = findSourceMap(__filename).payload.sources[0].slice(7, -9)
  pathMapper['koishi/'] = new RegExp(`(at | \\()${escapeRegExp(path)}`, 'g')
  Object.entries(config.setupFiles).forEach(([name, path]) => {
    const sourceMap = findSourceMap(path)
    if (sourceMap) path = sourceMap.payload.sources[0].slice(7)
    return pathMapper[name] = new RegExp(`(at | \\()${escapeRegExp(path)}`, 'g')
  })
}, logger.warn).then(() => {
  expose(parentPort, new WorkerAPI())
})
