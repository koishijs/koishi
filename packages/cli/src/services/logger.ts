import { App, Logger, Schema, Time, version } from 'koishi'
import { FileHandle, open } from 'fs/promises'
import { mkdirSync } from 'fs'
import { resolve } from 'path'
import { Loader } from '../loader'
import {} from '../..'

const LoggerConfig = Schema.object({
  levels: Schema.any('默认的日志输出等级。'),
  showDiff: Schema.boolean('标注相邻两次日志输出的时间差。'),
  showTime: Schema.union([Schema.boolean(), Schema.string()], '输出日志所使用的时间格式。'),
  root: Schema.string('输出日志所用的本地目录。'),
}, '日志设置')

App.Config.list.push(Schema.object({
  logger: LoggerConfig.hidden(),
}))

export function prepare(loader: Loader, config: App.Config.Logger = {}) {
  // configurate logger levels
  if (typeof config.levels === 'object') {
    Logger.levels = config.levels as any
  } else if (typeof config.levels === 'number') {
    Logger.levels.base = config.levels
  }

  let showTime = config.showTime
  if (showTime === true) showTime = 'yyyy-MM-dd hh:mm:ss'
  if (showTime) Logger.targets[0].showTime = showTime
  Logger.targets[0].showDiff = config.showDiff ?? !showTime

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

  if (config.root) {
    const root = resolve(loader.dirname, config.root)
    mkdirSync(root, { recursive: true })

    function createLogFile() {
      date = Time.template('yyyy-MM-dd')
      file = new FileWrapper(`${root}/${date}.log`)
    }

    createLogFile()
    Logger.targets.push({
      colors: 3,
      showTime: 'yyyy-MM-dd hh:mm:ss',
      print(text) {
        if (!text.startsWith(date)) {
          file.close()
          createLogFile()
        }
        file.write(text)
        if (loader.app?.isActive) {
          loader.app.emit('logger/data', text)
        }
      },
    })
  }

  new Logger('app').info('%C', `Koishi/${version}`)
  Logger.timestamp = Date.now()
}

let date: string, file: FileWrapper

export function apply(ctx: App) {
  ctx.on('logger/read', () => {
    return file.read()
  })
}

class FileWrapper {
  private task: Promise<FileHandle>
  private content: string[]

  constructor(path: string) {
    this.task = open(path, 'a+').then(async (handle) => {
      const text = await handle.readFile('utf-8')
      this.content = text.split(/\n(?=\S)/g)
      return handle
    })
  }

  async read() {
    await this.task
    return this.content
  }

  async write(text: string) {
    const handle = await this.task
    await handle.write(text + '\n')
    this.content.push(text)
  }

  async close() {
    const handle = await this.task
    await handle.close()
  }
}
