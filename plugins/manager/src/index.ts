import { Context, Schema } from 'koishi'
import { resolve } from 'path'
import { BotProvider } from './bots'
import { MarketProvider } from './market'
import { PackageProvider } from './packages'
import { AdapterProvider } from './protocols'
import { RegistryProvider } from './registry'
import { ReleaseProvider } from './releases'
import { ServiceProvider } from './services'

export * from './bots'
export * from './market'
export * from './packages'
export * from './protocols'
export * from './registry'
export * from './releases'
export * from './services'
export * from './utils'

declare module 'koishi' {
  interface Modules {
    manager: typeof import('.')
  }
}

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Services {
      bots: BotProvider
      market: MarketProvider
      packages: PackageProvider
      protocols: AdapterProvider
      registry: RegistryProvider
      releases: ReleaseProvider
      services: ServiceProvider
    }
  }
}

export const name = 'manager'
export const using = ['console']

export interface Config extends MarketProvider.Config {}

export const Config = Schema.intersect([
  MarketProvider.Config,
])

Context.service('console/bots')
Context.service('console/market')
Context.service('console/packages')
Context.service('console/protocols')
Context.service('console/registry')
Context.service('console/releases')
Context.service('console/services')

export function apply(ctx: Context, config: Config = {}) {
  ctx.plugin(BotProvider)
  ctx.plugin(MarketProvider, config)
  ctx.plugin(AdapterProvider)
  ctx.plugin(PackageProvider)
  ctx.plugin(RegistryProvider)
  ctx.plugin(ReleaseProvider)
  ctx.plugin(ServiceProvider)

  const filename = ctx.console.config.devMode ? '../client/index.ts' : '../dist/index.js'
  ctx.console.addEntry(resolve(__dirname, filename))

  for (const event of ['install', 'dispose', 'reload', 'save'] as const) {
    ctx.console.addListener(`plugin/${event}`, async ({ name, config }) => {
      ctx.emit(`config/plugin-${event}`, name, config)
    })
  }

  ctx.console.addListener('bot/create', async ({ platform, protocol, config }) => {
    ctx.emit('config/bot-create', platform, { protocol, ...config })
  })

  for (const event of ['remove', 'start', 'stop'] as const) {
    ctx.console.addListener(`bot/${event}`, async ({ id }) => {
      ctx.emit(`config/bot-${event}`, id)
    })
  }
}
