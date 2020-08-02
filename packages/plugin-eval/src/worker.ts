import { InspectOptions, formatWithOptions } from 'util'
import { Meta, UserField, getUsage, App, UserData } from 'koishi-core'
import { parentPort, workerData } from 'worker_threads'
import { expose, Remote } from './comlink'
import { VM } from './vm'
import { defineProperty } from 'koishi-utils'

export interface WorkerConfig {
  inspect?: InspectOptions
}

const config: WorkerConfig = {
  inspect: {
    depth: 0,
    ...workerData.inspect,
  }
}

export default class Global {
  api: Remote<EvalAPI>

  constructor () {
    for (const key of Object.getOwnPropertyNames(Global.prototype)) {
      if (key.startsWith('_') || key === 'constructor') continue
      this[key] = Global.prototype[key].bind(this)
    }
  }

  exec (message: string) {
    return this.api.execute(message)
  }

  log (format: string, ...param: any[]) {
    return this.api.send(formatWithOptions(config.inspect, format, ...param))
  }

  // usage (name: string) {
  //   return getUsage(name, this.main.$user)
  // }
}

interface EvalOptions {
  user: string
  output: boolean
  source: string
}

interface EvalAPI {
  send (message: string): Promise<void>
  execute (message: string): Promise<void>
}

const sandbox = new Global()

const vm = new VM({ sandbox })

export class WorkerAPI {
  async eval (options: EvalOptions, main: EvalAPI) {
    const { source, user, output } = options
    defineProperty(sandbox, 'api', main)
    vm.setGlobal('user', JSON.parse(user))
    try {
      const result = await vm.run(source, 'stdin')
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
