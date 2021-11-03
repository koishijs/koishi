import { Context } from 'koishi'
import { resolve } from 'path'
import { StatusServer } from '@koishijs/plugin-console'
import { BotSource } from './bots'
import { MarketSource } from './market'
import { ProtocolSource } from './protocols'
import { RegistrySource } from './registry'
import { ServiceSource } from './services'

export * from './bots'
export * from './market'
export * from './protocols'
export * from './registry'
export * from './services'

declare module 'koishi' {
  interface Modules {
    configurator: typeof import('.')
  }
}

export interface Config extends RegistrySource.Config, MarketSource.Config {}

export const name = 'configurator'

export function apply(ctx: Context, config: Config = {}) {
  ctx.with(['console'], () => {
    const filename = ctx.webui.config.devMode ? '../client/index.ts' : '../dist/index.js'
    ctx.webui.addEntry(resolve(__dirname, filename))
    ctx.webui.sources.bots = new BotSource(ctx)
    ctx.webui.sources.market = new MarketSource(ctx, config)
    ctx.webui.sources.protocols = new ProtocolSource(ctx)
    ctx.webui.sources.registry = new RegistrySource(ctx, config)
    ctx.webui.sources.services = new ServiceSource(ctx)
  })
}

StatusServer.listeners.install = async function ({ name }) {
  if (await this.validate()) return this.send('unauthorized')
  this.app.webui.sources.market.install(name)
}

StatusServer.listeners.switch = async function ({ plugin }) {
  if (await this.validate()) return this.send('unauthorized')
  this.app.webui.sources.registry.switch(plugin)
}

for (const event of ['install', 'dispose', 'reload', 'save'] as const) {
  StatusServer.listeners[`plugin/${event}`] = async function ({ name, config }) {
    if (await this.validate()) return this.send('unauthorized')
    this.app.emit(`config/plugin-${event}`, name, config)
  }
}

StatusServer.listeners[`bot/create`] = async function ({ platform, protocol, config }) {
  if (await this.validate()) return this.send('unauthorized')
  this.app.emit('config/bot-create', platform, { protocol, ...config })
}

for (const event of ['remove', 'start', 'stop'] as const) {
  StatusServer.listeners[`bot/${event}`] = async function ({ id }) {
    if (await this.validate()) return this.send('unauthorized')
    this.app.emit(`config/bot-${event}`, id)
  }
}
