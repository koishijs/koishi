import { App, Context, Dict, Schema, Time } from 'koishi'
import * as daemon from './daemon'
import * as logger from './logger'
import Watcher from './watcher'

declare module 'koishi' {
  interface App {
    prologue: string[]
    watcher: Watcher
  }

  namespace App {
    interface Config extends daemon.Config {
      plugins?: Dict
      timezoneOffset?: number
      stackTraceLimit?: number
      allowWrite?: boolean
      logger?: logger.Config
      watch?: Watcher.Config
    }
  }
}

App.Config.list.push(Schema.object({
  autoRestart: Schema.boolean().description('应用在运行时崩溃自动重启。').default(true).hidden(),
  allowWrite: Schema.boolean().description('允许在运行时修改配置文件。').default(true),
  timezoneOffset: Schema.number().description('时区偏移量 (分钟)。'),
  stackTraceLimit: Schema.number().description('报错的调用堆栈深度。').default(10),
  plugins: Schema.object({}).hidden(),
}).description('CLI 设置'))

export const name = 'CLI'

Context.service('loader')

export function prepare(config: App.Config) {
  logger.prepare(config.logger)

  if (config.timezoneOffset !== undefined) {
    Time.setTimezoneOffset(config.timezoneOffset)
  }

  if (config.stackTraceLimit !== undefined) {
    Error.stackTraceLimit = config.stackTraceLimit
  }
}

export function apply(ctx: Context, config: App.Config) {
  logger.apply(ctx.app)
  ctx.plugin(daemon, config)

  if (process.env.KOISHI_WATCH_ROOT !== undefined) {
    (config.watch ??= {}).root = process.env.KOISHI_WATCH_ROOT
  }

  if (config.watch) ctx.plugin(Watcher, config.watch)
}
