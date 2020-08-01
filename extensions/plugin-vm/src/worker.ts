import { InspectOptions, formatWithOptions } from 'util'
import { Meta, UserField, getUsage, App, UserData } from 'koishi-core'
import { parentPort, workerData } from 'worker_threads'
import { expose, wrap, Remote } from './comlink'
import { VM } from './vm'
import { defineProperty } from 'koishi-utils'

export interface Options {
  timeout?: number
  inspect?: InspectOptions
}

const config: Options = {
  timeout: 1000,
  ...workerData,
  inspect: {
    depth: 0,
    ...workerData.inspect,
  }
}

export default class Global {
  main: Remote<MainAPI>

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
    console.log('log!')
    return this.main.send(formatWithOptions(config.inspect, format, ...param))
  }

  // usage (name: string) {
  //   return getUsage(name, this.main.$user)
  // }
}

interface MainAPI {
  user: UserData
  send (message: string): Promise<void>
  execute (message: string): Promise<void>
}

const { timeout } = config

const sandbox = new Global()

const vm = new VM({
  timeout,
  sandbox,
})

export class WorkerAPI {
  async eval (expression: string, main: MainAPI, output = false) {
    defineProperty(sandbox, 'main', main)
    try {
      const result = await vm.run(expression, 'stdin')
      if (result !== undefined && output) await sandbox.log(result)
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
