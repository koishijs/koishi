import { App, version, Logger, Time, Schema } from 'koishi'
import { performance } from 'perf_hooks'
import { Loader } from './loader'
import { createFileWatcher } from './services/watcher'
import { createConfigManager } from './services/config'
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

// configurate logger levels
if (typeof config.logLevel === 'object') {
  Logger.levels = config.logLevel as any
} else if (typeof config.logLevel === 'number') {
  Logger.levels.base = config.logLevel
}

if (config.logTime === true) config.logTime = 'yyyy/MM/dd hh:mm:ss'
if (config.logTime) Logger.showTime = config.logTime

// cli options have higher precedence
if (process.env.KOISHI_LOG_LEVEL) {
  Logger.levels.base = +process.env.KOISHI_LOG_LEVEL
}

function ensureBaseLevel(config: Logger.LevelConfig, base: number) {
  config.base ??= base
  Object.values(config).forEach((value) => {
    if (typeof value !== 'object') return
    ensureBaseLevel(value, config.base)
  })
}

ensureBaseLevel(Logger.levels, 2)

if (process.env.KOISHI_DEBUG) {
  for (const name of process.env.KOISHI_DEBUG.split(',')) {
    new Logger(name).level = Logger.DEBUG
  }
}

if (config.timezoneOffset !== undefined) {
  Time.setTimezoneOffset(config.timezoneOffset)
}

if (config.stackTraceLimit !== undefined) {
  Error.stackTraceLimit = config.stackTraceLimit
}

if (config.proxyAgent !== undefined) {
  const ProxyAgent = require('proxy-agent') as typeof import('proxy-agent')
  const axiosConfig = config.axiosConfig ||= {}
  axiosConfig.httpAgent = new ProxyAgent(config.proxyAgent)
  axiosConfig.httpsAgent = new ProxyAgent(config.proxyAgent)
}

interface Message {
  type: 'send'
  body: any
}

process.on('message', (data: Message) => {
  if (data.type === 'send') {
    const { channelId, guildId, sid, message } = data.body
    const bot = app.bots.get(sid)
    bot.sendMessage(channelId, message, guildId)
  }
})

App.NetworkConfig.dict = {
  host: Schema.string('要监听的 IP 地址。如果将此设置为 `0.0.0.0` 将监听所有地址，包括局域网和公网地址。'),
  port: Schema.number('要监听的端口。'),
  ...App.NetworkConfig.dict,
  proxyAgent: Schema.string('使用的代理服务地址。'),
}

App.Config.list.push(Schema.object({
  allowWrite: Schema.boolean('允许插件修改本地配置文件。'),
  deamon: Schema.object({
    autoRestart: Schema.boolean('当应用在运行时崩溃将自动重启。').default(true),
  }),
  plugins: Schema.any().hidden(),
}, 'CLI 设置'))

const app = loader.createApp(config)

app.plugin(deamon, config.deamon)

process.on('unhandledRejection', (error) => {
  logger.warn(error)
})

app.start().then(() => {
  logger.info('%C', `Koishi/${version}`)

  const time = Math.max(0, performance.now() - +process.env.KOISHI_START_TIME).toFixed()
  logger.success(`bot started successfully in ${time} ms`)
  Logger.timestamp = Date.now()
  Logger.showDiff = config.logDiff ?? !Logger.showTime

  createFileWatcher(app, loader)
  createConfigManager(app, loader)
}, handleException)
