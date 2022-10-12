import { Context, Dict, Logger, Schema, Time } from 'koishi'
import Loader from '@koishijs/loader'
import * as daemon from './daemon'
import * as logger from './logger'
import Watcher from './watcher'

export * from '@koishijs/loader'

export { Loader, Watcher }

declare module 'koishi' {
  interface Events {
    'exit'(signal: NodeJS.Signals): Promise<void>
  }

  interface Context {
    prologue: string[]
    watcher: Watcher
  }

  namespace Context {
    interface Config extends daemon.Config {
      plugins?: Dict
      timezoneOffset?: number
      stackTraceLimit?: number
      logger?: logger.Config
      watch?: Watcher.Config
    }
  }
}

Object.assign(Context.Config.Advanced.dict, {
  autoRestart: Schema.boolean().description('应用在运行时崩溃自动重启。').default(true).hidden(),
  timezoneOffset: Schema.number().description('时区偏移量 (分钟)。').default(new Date().getTimezoneOffset()),
  stackTraceLimit: Schema.natural().description('报错的调用堆栈深度。').default(10),
  plugins: Schema.object({}).hidden(),
})

function handleException(error: any) {
  new Logger('app').error(error)
  process.exit(1)
}

process.on('uncaughtException', handleException)

process.on('unhandledRejection', (error) => {
  new Logger('app').warn(error)
})

const loader = new Loader(process.env.KOISHI_CONFIG_FILE)
const config = loader.readConfig()

logger.prepare(config.logger)

if (config.timezoneOffset !== undefined) {
  Time.setTimezoneOffset(config.timezoneOffset)
}

if (config.stackTraceLimit !== undefined) {
  Error.stackTraceLimit = config.stackTraceLimit
}

namespace addons {
  export const name = 'CLI'

  export function apply(ctx: Context, config: Context.Config) {
    logger.apply(ctx.app)
    ctx.plugin(daemon, config)

    if (process.env.KOISHI_WATCH_ROOT !== undefined) {
      (config.watch ??= {}).root = process.env.KOISHI_WATCH_ROOT
      ctx.plugin(Watcher, config.watch)
    }
  }
}

async function start() {
  const app = await loader.createApp()
  app.plugin(addons, app.config)
  await app.start()
}

start().catch(handleException)
