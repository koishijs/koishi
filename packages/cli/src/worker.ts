import { Dict, Logger, Time } from 'koishi'
import { Loader } from './loader'
import * as addons from './addons'

declare module 'koishi' {
  namespace App {
    interface Config {
      plugins?: Dict
      timezoneOffset?: number
      stackTraceLimit?: number
    }
  }

  interface EventMap {
    'exit'(signal: NodeJS.Signals): Promise<void>
    'reload'(path: string): Promise<void>
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

addons.prepare(config)

if (config.timezoneOffset !== undefined) {
  Time.setTimezoneOffset(config.timezoneOffset)
}

if (config.stackTraceLimit !== undefined) {
  Error.stackTraceLimit = config.stackTraceLimit
}

const app = loader.createApp()

app.plugin(addons, app.options)
app.start()
