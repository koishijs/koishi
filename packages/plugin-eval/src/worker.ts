import { InspectOptions, formatWithOptions } from 'util'
import { Meta, UserField, getUsage, App, UserData } from 'koishi-core'
import { parentPort, workerData } from 'worker_threads'
import { expose, Remote } from './comlink'
import { VM } from './vm'
import { MainAPI } from '.'
import { defineProperty } from 'koishi-utils'
import { getHeapStatistics } from 'v8'

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
  private user: UserData
  private meta: Meta
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

  // usage (name: string) {
  //   return getUsage(name, this.main.$user)
  // }
}

interface EvalOptions {
  meta: string
  user: string
  output: boolean
  source: string
}

const sandbox = new Global()

const vm = new VM({ sandbox })

export class WorkerAPI {
  async eval (options: EvalOptions, main: MainAPI) {
    const { meta, source, user, output } = options
    defineProperty(sandbox, 'main', main)
    vm.setGlobal('user', JSON.parse(user))
    vm.setGlobal('meta', JSON.parse(meta))
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
