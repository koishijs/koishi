import { App, Context } from 'koishi'
import * as daemon from './daemon'
import * as logger from './logger'
import Watcher from './watcher'

declare module 'koishi' {
  interface App {
    _prolog: string[]
    watcher: Watcher
  }

  namespace App {
    interface Config extends daemon.Config {
      allowWrite?: boolean
      logger?: logger.Config
      watch?: Watcher.Config
    }
  }
}

export const name = 'CLI'

export function prepare(config: App.Config) {
  logger.prepare(config.logger)
}

export function apply(ctx: Context, config: App.Config) {
  logger.apply(ctx.app)
  ctx.plugin(daemon, config)

  if (process.env.KOISHI_WATCH_ROOT !== undefined) {
    (config.watch ??= {}).root = process.env.KOISHI_WATCH_ROOT
  }

  if (config.watch) ctx.plugin(Watcher, config.watch)
}
