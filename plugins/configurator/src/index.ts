import { Context } from 'koishi'
import { StatusServer } from '@koishijs/plugin-console'
import Registry from './registry'
import Market from './market'
import { resolve } from 'path'

export { Registry, Market }

export interface Config extends Registry.Config, Market.Config {}

export const name = 'configurator'

export function apply(ctx: Context, config: Config = {}) {
  ctx.with(['console'], () => {
    const filename = ctx.webui.config.devMode ? '../client/index.ts' : '../dist/index.js'
    ctx.webui.addEntry(resolve(__dirname, filename))
    ctx.webui.sources.registry = new Registry(ctx, config)
    ctx.webui.sources.market = new Market(ctx, config)
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
