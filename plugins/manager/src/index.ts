import { Context, Schema } from 'koishi'
import { resolve } from 'path'
import { BotProvider } from './bots'
import { MarketProvider } from './market'
import { PackageProvider } from './packages'
import { AdapterProvider } from './protocols'
import { RegistryProvider } from './registry'
import { ReleaseProvider } from './releases'

export * from './bots'
export * from './market'
export * from './packages'
export * from './protocols'
export * from './registry'
export * from './releases'
export * from './shared'

declare module 'koishi' {
  interface Modules {
    manager: typeof import('.')
  }
}

export const name = 'manager'

export interface Config extends MarketProvider.Config {}

export const Config = Schema.intersect([
  MarketProvider.Config,
])

export function apply(ctx: Context, config: Config = {}) {
  ctx.with(['console'], (ctx) => {
    ctx.plugin(BotProvider)
    ctx.plugin(MarketProvider, config)
    ctx.plugin(AdapterProvider)
    ctx.plugin(PackageProvider)
    ctx.plugin(RegistryProvider)
    ctx.plugin(ReleaseProvider)

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
  })
}
