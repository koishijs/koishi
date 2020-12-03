import { App, AppOptions, Context, Plugin } from 'koishi-core'
import { resolve, dirname } from 'path'
import { Logger, noop } from 'koishi-utils'
import { performance } from 'perf_hooks'
import { yellow } from 'kleur'

const logger = new Logger('app')
const _require = module.require
const { version } = _require('../package')

export { version }

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

export type PluginConfig = (string | Plugin<Context> | [string | Plugin<Context>, any?])[]

export interface AppConfig extends AppOptions {
  plugins?: PluginConfig
  logLevel?: number
  logFilter?: Record<string, number>
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
  if (name.startsWith('.')) {
    modules.push(resolve(configDir, name))
  } else if (!name.includes(prefix)) {
    const index = name.lastIndexOf('/')
    modules.push(name.slice(0, index + 1) + prefix + name.slice(index + 1), name)
  } else {
    modules.push(name)
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

interface Message {
  type: 'send'
  payload: any
}

process.on('message', (data: Message) => {
  if (data.type === 'send') {
    const { groupId, userId, selfId, message } = data.payload
    const bot = app.bots[selfId]
    if (groupId) {
      bot.sendGroupMsg(groupId, message)
    } else {
      bot.sendPrivateMsg(userId, message)
    }
  }
})

// load adapter
try {
  const [name] = config.type.split(':', 1)
  loadEcosystem('adapter', name)
} catch {}

const app = new App(config)

app.command('exit', '停止机器人运行', { authority: 4 })
  .option('restart', '-r  重新启动')
  .shortcut('关机', { prefix: true })
  .shortcut('重启', { prefix: true, options: { restart: true } })
  .action(async ({ options, session }) => {
    const { groupId, userId, selfId } = session
    if (!options.restart) {
      await session.$send('正在关机……').catch(noop)
      process.exit()
    }
    process.send({ type: 'exit', payload: { groupId, userId, selfId, message: '已成功重启。' } })
    await session.$send(`正在重启……`).catch(noop)
    process.exit(514)
  })

// load plugins
if (Array.isArray(config.plugins)) {
  for (const item of config.plugins) {
    let plugin: Plugin<Context>, options: any
    if (Array.isArray(item)) {
      plugin = typeof item[0] === 'string' ? loadEcosystem('plugin', item[0]) : item[0]
      options = item[1]
    } else if (typeof item === 'string') {
      plugin = loadEcosystem('plugin', item)
    } else {
      plugin = item
    }
    app.plugin(plugin, options)
  }
}

process.on('unhandledRejection', (error) => {
  logger.warn(error)
})

app.start().then(() => {
  app.bots.forEach(bot => {
    if (!bot.version) return
    logger.info('%C', `Koishi/${version} ${bot.version}`)
  })

  const time = Math.max(0, performance.now() - +process.env.KOISHI_START_TIME).toFixed()
  logger.success(`bot started successfully in ${time} ms.`)
  process.send({ type: 'start' })
}, handleException)
