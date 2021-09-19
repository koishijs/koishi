import { App, Logger, Time, Schema } from 'koishi'
import { Loader } from './loader'
import { createFileWatcher } from './services/watcher'
import { createConfigManager } from './services/config'
import { prepareLogger } from './services/logger'
import * as deamon from './services/deamon'
import {} from '..'

const logger = new Logger('app')

function handleException(error: any) {
  logger.error(error)
  process.exit(1)
}

process.on('uncaughtException', handleException)

const loader = new Loader()

const config: App.Config = loader.loadConfig()

prepareLogger(loader, config.logger)

if (config.timezoneOffset !== undefined) {
  Time.setTimezoneOffset(config.timezoneOffset)
}

if (config.stackTraceLimit !== undefined) {
  Error.stackTraceLimit = config.stackTraceLimit
}

App.Config.list.push(Schema.object({
  allowWrite: Schema.boolean('允许插件修改本地配置文件。'),
  autoRestart: Schema.boolean('应用在运行时崩溃自动重启。').default(true),
  plugins: Schema.any().hidden(),
}, 'CLI 设置'))

const app = loader.createApp(config)

app.plugin(deamon, config)

process.on('unhandledRejection', (error) => {
  logger.warn(error)
})

app.start().then(() => {
  createFileWatcher(app, loader)
  createConfigManager(app, loader)
}, handleException)
