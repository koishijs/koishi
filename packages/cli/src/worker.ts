import { App, Logger, Time, Schema } from 'koishi'
import { Loader } from './loader'
import { createFileWatcher } from './services/watcher'
import { createConfigManager } from './services/config'
import * as logger from './services/logger'
import * as deamon from './services/deamon'
import {} from '..'

function handleException(error: any) {
  new Logger('app').error(error)
  process.exit(1)
}

process.on('uncaughtException', handleException)

const loader = new Loader()

const config: App.Config = loader.loadConfig()

logger.prepare(loader, config.logger)

if (config.timezoneOffset !== undefined) {
  Time.setTimezoneOffset(config.timezoneOffset)
}

if (config.stackTraceLimit !== undefined) {
  Error.stackTraceLimit = config.stackTraceLimit
}

App.Config.list.push(Schema.object({
  allowWrite: Schema.boolean().description('允许插件修改本地配置文件。'),
  autoRestart: Schema.boolean().description('应用在运行时崩溃自动重启。').default(true),
  plugins: Schema.any().hidden(),
}).description('CLI 设置'))

const app = loader.createApp(config)

app.plugin(deamon, config)

process.on('unhandledRejection', (error) => {
  new Logger('app').warn(error)
})

app.start().then(() => {
  createFileWatcher(app, loader)
  createConfigManager(app, loader)
}, handleException)
