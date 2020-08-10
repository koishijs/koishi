import { InspectOptions, formatWithOptions } from 'util'
import { Session, User } from 'koishi-core'
import { parentPort, workerData } from 'worker_threads'
import { expose, Remote, status } from './comlink'
import { VM } from './vm'
import { MainAPI } from '.'
import { defineProperty } from 'koishi-utils'

export interface WorkerConfig {
  setupFiles?: string[]
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

export function setGlobal <K extends keyof Global> (key: K, value: Bind<Global, K>, writable = false) {
  if (typeof value === 'function') {
    value = value['bind'](sandbox)
  }
  vm._internal.setGlobal(key, value, writable)
}

export class WorkerAPI {
  async eval (options: EvalOptions, main: MainAPI) {
    const { session, source, user, output } = options
    defineProperty(sandbox, 'main', main)
    vm.setGlobal('user', JSON.parse(user))
    vm.setGlobal('session', JSON.parse(session))
    try {
      const result = await vm.run(source, 'stdin')
      if (result !== undefined && output) await sandbox.log(result)
    } catch (error) {
      if (error.name === 'SyntaxError') {
        const message = 'SyntaxError: ' + error.message
        const lines: string[] = error.stack.split('\n')
        const index = lines.indexOf(message) + 1
        if (lines[index].startsWith('    at new Script')) {
          return main.send(`${message}\n    at ${lines[0]}:${lines[2].length}`)
        }
      }
      return main.send(error.stack.replace(/\s*.+Script[\s\S]*/, ''))
    }
  }
}

Promise
  .all(config.setupFiles.map(file => require(file).default))
  .then(() => {
    status(parentPort)
    expose(new WorkerAPI(), parentPort)
  }, (err) => {
    status(parentPort, err instanceof Error ? err : new Error(err))
  })
