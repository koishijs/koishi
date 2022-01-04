import { App, Context } from 'koishi'
import * as daemon from './daemon'
import FileWatcher, { WatchConfig } from './watcher'
import ConfigWriter from './writer'

declare module 'koishi' {
  namespace Context {
    interface Services {
      configWriter: ConfigWriter
      fileWatcher: FileWatcher
    }
  }

  namespace App {
    interface Config extends daemon.Config {
      allowWrite?: boolean
      watch?: WatchConfig
    }
  }
}

export const name = 'CLI'

export function apply(ctx: Context, config: App.Config) {
  ctx.plugin(daemon, config)
  ctx.plugin(ConfigWriter)

  if (process.env.KOISHI_WATCH_ROOT !== undefined) {
    (config.watch ??= {}).root = process.env.KOISHI_WATCH_ROOT
  }

  if (config.watch) ctx.plugin(FileWatcher, config.watch)
}
