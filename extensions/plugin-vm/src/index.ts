import { Context, Meta, userFields, getUsage, UserField } from 'koishi-core'
import { CQCode, defineProperty } from 'koishi-utils'
import { formatWithOptions, InspectOptions } from 'util'
import { VM } from './vm'

export interface Options {
  maxLogCount?: number
  timeout?: number
  inspect?: InspectOptions
}

const defaultOptions: Options = {
  maxLogCount: 4,
  timeout: 1000,
  inspect: {
    depth: 0,
  },
}

export default class Global {
  static config: Options

  logCount: number
  meta: Meta<UserField>

  constructor () {
    for (const key of Object.getOwnPropertyNames(Global.prototype)) {
      if (key.startsWith('_') || key === 'constructor') continue
      this[key] = Global.prototype[key].bind(this)
    }
  }

  exec (message: string) {
    return this.meta.$app.execute(message, this.meta)
  }

  log (format: string, ...param: any[]) {
    if (++this.logCount > Global.config.maxLogCount) return
    return this.meta.$send(formatWithOptions(Global.config.inspect, format, ...param))
  }

  usage (name: string) {
    return getUsage(name, this.meta.$user)
  }
}

export const name = 'vm'

export function apply (ctx: Context, options: Options = {}) {
  const { timeout } = Global.config = {
    ...defaultOptions,
    ...options,
    inspect: {
      ...defaultOptions.inspect,
      ...options.inspect,
    },
  }

  let sandbox: Global, vm: VM
  ctx.on('before-connect', () => {
    sandbox = new Global()

    vm = new VM({
      timeout,
      sandbox,
    })
  })

  ctx.command('eval <expression...>', '执行 JavaScript 脚本', { authority: 3 })
    .userFields(userFields)
    .shortcut('>', { oneArg: true, fuzzy: true })
    .shortcut('>>', { oneArg: true, fuzzy: true, options: { output: true } })
    .option('-o, --output', '输出最后的结果')
    .action(async ({ meta, options }, expression) => {
      if (!expression) return
      defineProperty(sandbox, 'logCount', 0)
      defineProperty(sandbox, 'meta', meta)

      try {
        const result = await vm.run(CQCode.unescape(expression))
        if (result !== undefined && options.output) return sandbox.log(result)
      } catch (error) {
        if (error.message === 'Script execution timed out.') {
          return meta.$send('执行超时。')
        } else if (error.name === 'SyntaxError') {
          const lines = error.stack.split('\n')
          return meta.$send(`${lines[4]}\n    at ${lines[0].replace(/vm\.js/g, 'stdin')}:${lines[2].length}`)
        } else {
          return meta.$send(error.stack.replace(/\s*.+Script[\s\S]*/, '').replace(/vm\.js/g, 'stdin'))
        }
      }
    })
}
