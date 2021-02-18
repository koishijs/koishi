import { WorkerAPI, Context, response, mapDirectory, formatError } from 'koishi-plugin-eval/dist/worker'
import { Logger, Time, Segment, Random } from 'koishi-utils'
import { prepare, synthetize } from './loader'

export * from './loader'

const logger = new Logger('addon')

export interface AddonWorkerConfig {
  moduleRoot?: string
  cacheFile?: string
}

declare module 'koishi-plugin-eval/dist/worker' {
  interface WorkerConfig extends AddonWorkerConfig {}

  interface WorkerData {
    addonNames: string[]
  }

  interface WorkerAPI {
    callAddon(options: ContextOptions, argv: AddonArgv): Promise<string | void>
  }

  interface Response {
    commands: string[]
  }
}

interface AddonArgv {
  name: string
  args: string[]
  options: Record<string, any>
}

interface AddonContext extends AddonArgv, Context {}

type AddonAction = (ctx: AddonContext) => string | void | Promise<string | void>
const commandMap: Record<string, AddonAction> = {}

WorkerAPI.prototype.callAddon = async function (this: WorkerAPI, options, argv) {
  const callback = commandMap[argv.name]
  try {
    const ctx = { ...argv, ...Context(options) }
    const result = await callback(ctx)
    await this.sync(ctx)
    return result
  } catch (error) {
    if (!argv.options.debug) return logger.warn(error)
    return formatError(error)
      .replace('WorkerAPI.worker_1.WorkerAPI.callAddon', 'WorkerAPI.callAddon')
  }
}

synthetize('koishi/addons.ts', {
  registerCommand(name: string, callback: AddonAction) {
    commandMap[name] = callback
  },
})

synthetize('koishi/utils.ts', {
  Time, Segment, Random,
}, 'utils')

export default prepare().then(() => {
  response.commands = Object.keys(commandMap)
  mapDirectory('koishi/utils/', require.resolve('koishi-utils'))
})
