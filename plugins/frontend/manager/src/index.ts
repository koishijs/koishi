import { Context, Schema } from 'koishi'
import { resolve } from 'path'
import BotProvider from './bots'
import MarketProvider from './market'
import PackageProvider from './packages'
import AdapterProvider from './protocols'
import RegistryProvider from './registry'
import ReleaseProvider from './releases'
import ServiceProvider from './services'

export * from './bots'
export * from './market'
export * from './packages'
export * from './protocols'
export * from './registry'
export * from './releases'
export * from './services'
export * from './utils'

export {
  BotProvider,
  MarketProvider,
  PackageProvider,
  AdapterProvider,
  RegistryProvider,
  ReleaseProvider,
  ServiceProvider,
}

declare module '@koishijs/plugin-console' {
  interface Events {
    'plugin/load'(name: string, config: any): void
    'plugin/unload'(name: string): void
    'plugin/reload'(name: string, config: any): void
    'plugin/save'(name: string, config: any): void
    'bot/create'(platform: string, config: any): void
  }

  interface Sources {
    bots: BotProvider
    market: MarketProvider
    packages: PackageProvider
    protocols: AdapterProvider
    registry: RegistryProvider
    releases: ReleaseProvider
    services: ServiceProvider
  }
}

export const name = 'manager'
export const using = ['console'] as const

export interface Config extends MarketProvider.Config {}

export const Config = Schema.intersect([
  MarketProvider.Config,
])

Context.service('console.bots')
Context.service('console.market')
Context.service('console.packages')
Context.service('console.protocols')
Context.service('console.registry')
Context.service('console.releases')
Context.service('console.services')

export function apply(ctx: Context, config: Config = {}) {
  ctx.plugin(BotProvider)
  ctx.plugin(MarketProvider, config)
  ctx.plugin(AdapterProvider)
  ctx.plugin(PackageProvider)
  ctx.plugin(RegistryProvider)
  // ctx.plugin(ReleaseProvider)
  ctx.plugin(ServiceProvider)

  const filename = ctx.console.config.devMode ? '../client/index.ts' : '../dist/index.js'
  ctx.console.addEntry(resolve(__dirname, filename))

  ctx.using(['configWriter'], (ctx) => {
    ctx.console.addListener('plugin/load', (name, config) => {
      ctx.configWriter.loadPlugin(name, config)
    })

    ctx.console.addListener('plugin/unload', (name) => {
      ctx.configWriter.unloadPlugin(name)
    })

    ctx.console.addListener('plugin/reload', (name, config) => {
      ctx.configWriter.reloadPlugin(name, config)
    })

    ctx.console.addListener('plugin/save', (name, config) => {
      ctx.configWriter.savePlugin(name, config)
    })

    ctx.console.addListener('bot/create', (platform, config) => {
      ctx.configWriter.createBot(platform, config)
    })
  })
}
