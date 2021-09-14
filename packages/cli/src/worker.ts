import { App, version, Logger, noop, Time, template, Schema } from 'koishi'
import { performance } from 'perf_hooks'
import { createWatcher } from './watcher'
import { Loader } from './loader'
import {} from '..'

const logger = new Logger('app')

function handleException(error: any) {
  logger.error(error)
  process.exit(1)
}

process.on('uncaughtException', handleException)

function ensureBaseLevel(config: Logger.LevelConfig, base: number) {
  config.base ??= base
  Object.values(config).forEach((value) => {
    if (typeof value !== 'object') return
    ensureBaseLevel(value, config.base)
  })
}

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

const app = new App(config)

const { exitCommand, autoRestart = true } = config.deamon || {}

const handleSignal = (signal: NodeJS.Signals) => {
  new Logger('app').info(`terminated by ${signal}`)
  app.parallel('exit', signal).finally(() => process.exit())
}

template.set('deamon', {
  exiting: '正在关机……',
  restarting: '正在重启……',
  restarted: '已成功重启。',
})

exitCommand && app
  .command(exitCommand === true ? 'exit' : exitCommand, '停止机器人运行', { authority: 4 })
  .option('restart', '-r  重新启动')
  .shortcut('关机', { prefix: true })
  .shortcut('重启', { prefix: true, options: { restart: true } })
  .action(async ({ options, session }) => {
    const { channelId, guildId, sid } = session
    if (!options.restart) {
      await session.send(template('deamon.exiting')).catch(noop)
      process.exit()
    }
    process.send({ type: 'queue', body: { channelId, guildId, sid, message: template('deamon.restarted') } })
    await session.send(template('deamon.restarting')).catch(noop)
    process.exit(114)
  })

loader.loadPlugins(app)

process.on('unhandledRejection', (error) => {
  logger.warn(error)
})

app.start().then(() => {
  logger.info('%C', `Koishi/${version}`)

  const time = Math.max(0, performance.now() - +process.env.KOISHI_START_TIME).toFixed()
  logger.success(`bot started successfully in ${time} ms`)
  Logger.timestamp = Date.now()
  Logger.showDiff = config.logDiff ?? !Logger.showTime

  process.send({ type: 'start', body: { autoRestart } })
  createWatcher(app, loader)

  process.on('SIGINT', handleSignal)
  process.on('SIGTERM', handleSignal)
}, handleException)
