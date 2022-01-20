import { App, Context } from 'koishi'
import * as daemon from './daemon'
import * as logger from './logger'
import FileWatcher, { WatchConfig } from './watcher'
import ConfigWriter from './writer'

declare module 'koishi' {
  namespace Context {
    interface Services {
      configWriter: ConfigWriter
      fileWatcher: FileWatcher
    }
  }

  interface App {
    _prolog: string[]
  }

  namespace App {
    interface Config extends daemon.Config {
      logger?: logger.Config
      watch?: WatchConfig
    }
  }
}

export const name = 'CLI'

export function prepare(config: App.Config) {
  logger.prepare(config.logger)
}

export function apply(ctx: Context, config: App.Config) {
  ctx.plugin(logger)
  ctx.plugin(daemon, config)

  if (process.env.KOISHI_WATCH_ROOT !== undefined) {
    (config.watch ??= {}).root = process.env.KOISHI_WATCH_ROOT
  }

  if (ctx.app.loader.enableWriter) ctx.plugin(ConfigWriter)
  if (config.watch) ctx.plugin(FileWatcher, config.watch)
}
