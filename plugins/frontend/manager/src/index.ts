import { Context, Schema } from 'koishi'
import { resolve } from 'path'
import Installer from './installer'
import BotProvider from './bots'
import MarketProvider from './market'
import PackageProvider from './packages'
import ConfigWriter from './writer'

export * from './bots'
export * from './market'
export * from './packages'
export * from './writer'

export {
  Installer,
  BotProvider,
  MarketProvider,
  PackageProvider,
  ConfigWriter,
}

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Services {
      dependencies: Installer
      bots: BotProvider
      market: MarketProvider
      packages: PackageProvider
      config: ConfigWriter
    }
  }
}

export const name = 'manager'
export const using = ['console', 'loader'] as const

export interface Config extends MarketProvider.Config {}

export const Config: Schema<Config> = Schema.intersect([
  MarketProvider.Config,
])

export function apply(ctx: Context, config: Config) {
  if (!ctx.loader.writable) {
    return ctx.logger('manager').warn('manager is only available for json/yaml config file')
  }

  ctx.plugin(Installer)
  ctx.plugin(BotProvider)
  ctx.plugin(MarketProvider, config)
  ctx.plugin(PackageProvider)
  ctx.plugin(ConfigWriter)

  ctx.console.addEntry({
    dev: resolve(__dirname, '../client/index.ts'),
    prod: resolve(__dirname, '../dist'),
  })
}
