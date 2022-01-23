import { Context, Schema } from 'koishi'
import { resolve } from 'path'
import BotProvider from './bots'
import MarketProvider from './market'
import PackageProvider from './packages'
import AdapterProvider from './protocols'
import ServiceProvider from './services'
import ConfigWriter from './writer'

export * from './bots'
export * from './market'
export * from './packages'
export * from './protocols'
export * from './services'
export * from './utils'

export {
  BotProvider,
  MarketProvider,
  PackageProvider,
  AdapterProvider,
  ServiceProvider,
}

declare module '@koishijs/plugin-console' {
  interface Events {
    'plugin/load'(name: string, config: any): void
    'plugin/unload'(name: string, config: any): void
    'bot/create'(platform: string, config: any): void
  }

  interface Sources {
    bots: BotProvider
    market: MarketProvider
    packages: PackageProvider
    protocols: AdapterProvider
    services: ServiceProvider
  }
}

export const name = 'manager'
export const using = ['console', 'loader'] as const

export interface Config extends MarketProvider.Config {}

export const Config = Schema.intersect([
  MarketProvider.Config,
])

export function apply(ctx: Context, config: Config = {}) {
  ctx.plugin(BotProvider)
  ctx.plugin(MarketProvider, config)
  ctx.plugin(AdapterProvider)
  ctx.plugin(PackageProvider)
  ctx.plugin(ServiceProvider)
  ctx.plugin(ConfigWriter, ctx.app.options.allowWrite)

  const filename = ctx.console.config.devMode ? '../client/index.ts' : '../dist/index.js'
  ctx.console.addEntry(resolve(__dirname, filename))
}
