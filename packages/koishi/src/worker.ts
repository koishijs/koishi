import { App, BotOptions, Context, Plugin, version } from 'koishi-core'
import { resolve, dirname } from 'path'
import { Logger, noop } from 'koishi-utils'
import { performance } from 'perf_hooks'
import { yellow } from 'kleur'
import { AppConfig } from '..'

const logger = new Logger('app')

if (process.env.KOISHI_LOG_LEVEL) {
  Logger.baseLevel = +process.env.KOISHI_LOG_LEVEL
}

if (process.env.KOISHI_DEBUG) {
  Logger.levels = Object.fromEntries(process.env.KOISHI_DEBUG.split(',').map(name => [name, 3]))
}

function handleException(error: any) {
  logger.error(error)
  process.exit(1)
}

process.on('uncaughtException', handleException)

const configFile = resolve(process.cwd(), process.env.KOISHI_CONFIG_FILE || 'koishi.config')
const configDir = dirname(configFile)

function isErrorModule(error: any) {
  return error.code !== 'MODULE_NOT_FOUND' || error.requireStack && error.requireStack[0] !== __filename
}

function tryCallback<T>(callback: () => T) {
  try {
    return callback()
  } catch (error) {
    if (isErrorModule(error) && error.code !== 'ENOENT') {
      throw error
    }
  }
}

const config: AppConfig = tryCallback(() => require(configFile))

if (!config) {
  throw new Error(`config file not found. use ${yellow('koishi init')} command to initialize a config file.`)
}

const cacheMap: Record<string, any> = {}

function loadEcosystem(type: string, name: string) {
  const cache = cacheMap[name]
  if (cache) return cache

  const prefix = `koishi-${type}-`
  const modules: string[] = []
  if ('./'.includes(name[0])) {
    // absolute or relative path
    modules.push(resolve(configDir, name))
  } else if (name.includes(prefix)) {
    // full package path
    modules.push(name)
  } else if (name[0] === '@') {
    // scope package path
    const index = name.lastIndexOf('/')
    modules.push(name.slice(0, index + 1) + prefix + name.slice(index + 1), name)
  } else {
    // normal package path
    modules.push(prefix + name, name)
  }

  for (const path of modules) {
    logger.debug('resolving %c', path)
    try {
      const result = require(path)
      logger.info('apply %s %c', type, result.name || name)
      return cacheMap[name] = result
    } catch (error) {
      if (isErrorModule(error)) {
        throw error
      }
    }
  }
  throw new Error(`cannot resolve ${type} ${name}`)
}

Object.assign(Logger.levels, config.logFilter)
if (config.logLevel && !process.env.KOISHI_LOG_LEVEL) {
  Logger.baseLevel = config.logLevel
}

if (config.logTime === true) config.logTime = 'YYYY/MM/DD hh:mm:ss'
if (config.logTime) Logger.showTime = config.logTime

interface Message {
  type: 'send'
  payload: any
}

process.on('message', (data: Message) => {
  if (data.type === 'send') {
    const { channelId, sid, message } = data.payload
    const bot = app.bots[sid]
    bot.sendMessage(channelId, message)
  }
})

function loadAdapter(bot: BotOptions) {
  const [name] = bot.type.split(':', 1)
  loadEcosystem('adapter', name)
}

// load adapter
if (config.type) {
  loadAdapter(config)
} else {
  config.bots.forEach(loadAdapter)
}

const app = new App(config)

app.command('exit', '停止机器人运行', { authority: 4 })
  .option('restart', '-r  重新启动')
  .shortcut('关机', { prefix: true })
  .shortcut('重启', { prefix: true, options: { restart: true } })
  .action(async ({ options, session }) => {
    const { channelId, sid } = session
    if (!options.restart) {
      await session.send('正在关机……').catch(noop)
      process.exit()
    }
    process.send({ type: 'exit', payload: { channelId, sid, message: '已成功重启。' } })
    await session.send(`正在重启……`).catch(noop)
    process.exit(114)
  })

// load plugins
const pluginEntries = Array.isArray(config.plugins)
  ? config.plugins
  : Object.entries(config.plugins || {})
for (const item of pluginEntries) {
  let plugin: Plugin<Context>, options: any
  if (Array.isArray(item)) {
    plugin = typeof item[0] === 'string' ? loadEcosystem('plugin', item[0]) : item[0]
    options = item[1]
  } else {
    plugin = loadEcosystem('plugin', item)
  }
  app.plugin(plugin, options)
}

process.on('unhandledRejection', (error) => {
  logger.warn(error)
})

app.start().then(() => {
  const versions = new Set<string>([`koishi/${version}`])
  app.bots.forEach(bot => {
    if (!bot.version) return
    versions.add(bot.version)
  })

  logger.info('%C', [...versions].join(' '))
  const time = Math.max(0, performance.now() - +process.env.KOISHI_START_TIME).toFixed()
  logger.success(`bot started successfully in ${time} ms.`)
  Logger.timestamp = Date.now()
  Logger.showDiff = true

  process.send({ type: 'start' })
}, handleException)
