import { InspectOptions, formatWithOptions } from 'util'
import { Meta, UserField, getUsage, App, UserData } from 'koishi-core'
import { parentPort } from 'worker_threads'
import { expose, wrap, Remote, releaseProxy } from './comlink'
import { VM } from './vm'
import { defineProperty } from 'koishi-utils'

export interface Options {
  timeout?: number
  inspect?: InspectOptions
}

const defaultOptions: Options = {
  timeout: 1000,
  inspect: {
    depth: 0,
  },
}

export default class Global {
  static config: Options

  main: Remote<MainAPI>

  constructor () {
    for (const key of Object.getOwnPropertyNames(Global.prototype)) {
      if (key.startsWith('_') || key === 'constructor') continue
      this[key] = Global.prototype[key].bind(this)
    }
  }

  // exec (message: string) {
  //   return this.app.execute(message, this.meta)
  // }

  log (format: string, ...param: any[]) {
    return this.main.send(formatWithOptions(Global.config.inspect, format, ...param))
  }

  // usage (name: string) {
  //   return getUsage(name, this.meta.$user)
  // }
}

interface MainAPI {
  user: UserData
  send (message: string): Promise<void>
  execute (message: string): Promise<void>
}

export class WorkerAPI {
  vm: VM
  sandbox: any

  init (options: Options) {
    const { timeout } = Global.config = {
      ...defaultOptions,
      ...options,
      inspect: {
        ...defaultOptions.inspect,
        ...options.inspect,
      }
    }

    const sandbox = this.sandbox = new Global()

    this.vm = new VM({
      timeout,
      sandbox,
    })
  }

  async eval (expression: string, main: MainAPI, output = false) {
    defineProperty(this.sandbox, 'main', main)
    try {
      const result = await this.vm.run(expression, 'stdin')
      if (result !== undefined && output) await this.sandbox.log(result)
    } catch (error) {
      if (error.message === 'Script execution timed out.') {
        return main.send('执行超时。')
      } else if (error.name === 'SyntaxError') {
        const lines = error.stack.split('\n')
        return main.send(`${lines[4]}\n    at ${lines[0]}:${lines[2].length}`)
      } else {
        return main.send(error.stack.replace(/\s*.+Script[\s\S]*/, ''))
      }
    }
  }
}

expose(new WorkerAPI(), parentPort)
