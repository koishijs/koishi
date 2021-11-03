import { Context } from 'koishi'
import { resolve } from 'path'
import { StatusServer } from '@koishijs/plugin-console'
import { BotProvider } from './bots'
import { MarketProvider } from './market'
import { AdapterProvider } from './protocols'
import { RegistryProvider } from './registry'
import { ServiceProvider } from './services'

export * from './bots'
export * from './market'
export * from './protocols'
export * from './registry'
export * from './services'

declare module 'koishi' {
  interface Modules {
    manager: typeof import('.')
  }
}

export interface Config extends MarketProvider.Config {}

export const name = 'manager'

export function apply(ctx: Context, config: Config = {}) {
  ctx.with(['console'], (ctx) => {
    const filename = ctx.webui.config.devMode ? '../client/index.ts' : '../dist/index.js'
    ctx.webui.addEntry(resolve(__dirname, filename))
    ctx.plugin(BotProvider)
    ctx.plugin(MarketProvider, config)
    ctx.plugin(AdapterProvider)
    ctx.plugin(RegistryProvider)
    ctx.plugin(ServiceProvider)
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
