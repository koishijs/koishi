import { Context, defineProperty, Logger, remove, Schema, version } from 'koishi'

interface LogLevelConfig {
  // a little different from @koishijs/utils
  // we don't enforce user to provide a base here
  base?: number
  [K: string]: LogLevel
}

type LogLevel = number | LogLevelConfig

export interface Config {
  levels?: LogLevel
  showDiff?: boolean
  showTime?: string | boolean
}

export const Config: Schema<Config> = Schema.object({
  levels: Schema.any().description('默认的日志输出等级。'),
  showDiff: Schema.boolean().description('标注相邻两次日志输出的时间差。'),
  showTime: Schema.union([Boolean, String]).default(true).description('输出日志所使用的时间格式。'),
}).description('日志设置').hidden()

defineProperty(Context.Config, 'logger', Config)

Context.Config.list.push(Schema.object({
  logger: Config,
}))

const prologue: string[] = []

const target: Logger.Target = {
  colors: 3,
  showTime: 'yyyy-MM-dd hh:mm:ss',
  print: text => prologue.push(text),
}

export function prepare(config: Config = {}) {
  const { levels } = config
  // configurate logger levels
  if (typeof levels === 'object') {
    Logger.levels = levels as any
  } else if (typeof levels === 'number') {
    Logger.levels.base = levels
  }

  let showTime = config.showTime
  if (showTime === true) showTime = 'yyyy-MM-dd hh:mm:ss'
  if (showTime) Logger.targets[0].showTime = showTime
  Logger.targets[0].showDiff = config.showDiff

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

  Logger.targets.push(target)

  new Logger('app').info('%C', `Koishi/${version}`)
  Logger.timestamp = Date.now()
}

export function apply(app: Context) {
  app.prologue = prologue
  app.on('ready', () => {
    remove(Logger.targets, target)
  })
}
