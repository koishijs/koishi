import { Dict, Logger, Time } from 'koishi'
import { LoggerConfig, prepareLogger } from './logger'
import { Loader } from './loader'
import * as addons from './addons'

declare module 'koishi' {
  namespace App {
    interface Config {
      plugins?: Dict
      logger?: LoggerConfig
      timezoneOffset?: number
      stackTraceLimit?: number
    }
  }

  interface EventMap {
    'exit'(signal: NodeJS.Signals): Promise<void>
    'reload'(path: string): Promise<void>
    'logger/read'(date?: string): Promise<string[]>
    'logger/data'(text: string): void
  }
}

function handleException(error: any) {
  new Logger('app').error(error)
  process.exit(1)
}

process.on('uncaughtException', handleException)

process.on('unhandledRejection', (error) => {
  new Logger('app').warn(error)
})

const loader = new Loader()
const config = loader.loadConfig()

prepareLogger(config.logger)

if (config.timezoneOffset !== undefined) {
  Time.setTimezoneOffset(config.timezoneOffset)
}

if (config.stackTraceLimit !== undefined) {
  Error.stackTraceLimit = config.stackTraceLimit
}

const app = loader.createApp(config)

app.plugin(addons, config)
app.start()
