import { Adapter, Bot, Context } from 'koishi'
import { Loader } from '@koishijs/cli'

declare module '@koishijs/plugin-console' {
  interface Events {
    'manager/plugin-reload'(name: string, config: any): void
    'manager/plugin-unload'(name: string, config: any): void
    'manager/bot-update'(id: string, adapter: string, config: any): void
    'manager/bot-remove'(id: string): void
  }
}

export default class ConfigWriter {
  private loader: Loader
  private plugins: {}

  constructor(private ctx: Context) {
    this.loader = ctx.loader
    this.plugins = ctx.loader.config.plugins

    ctx.console.addListener('manager/plugin-reload', (name, config) => {
      this.reloadPlugin(name, config)
    })

    ctx.console.addListener('manager/plugin-unload', (name, config) => {
      this.unloadPlugin(name, config)
    })

    ctx.console.addListener('manager/bot-update', (id, adapter, config) => {
      this.updateBot(id, adapter, config)
    })

    ctx.console.addListener('manager/bot-remove', (id) => {
      this.removeBot(id)
    })
  }

  reloadPlugin(name: string, config: any) {
    delete this.plugins['~' + name]
    this.plugins[name] = config
    this.loader.writeConfig()
    this.loader.reloadPlugin(name)
  }

  unloadPlugin(name: string, config: any) {
    delete this.plugins[name]
    this.plugins['~' + name] = config
    this.loader.writeConfig()
    this.loader.unloadPlugin(name)
  }

  updateBot(id: string, adapter: string, config: any) {
    let bot: Bot
    const name = 'adapter-' + adapter
    if (id) {
      bot = this.ctx.bots.find(bot => bot.id === id)
      const index = bot.adapter.bots.indexOf(bot)
      this.plugins[name].bots[index] = config
    } else {
      if (!this.plugins[name]) {
        this.plugins[name] = { ...this.plugins['~' + name] }
        delete this.plugins['~' + name]
        this.loader.reloadPlugin(name)
      }
      this.plugins[name].bots.push(config)
      bot = this.ctx.bots.create(adapter, config)
    }
    this.loader.writeConfig()
    bot.config = Adapter.library[Adapter.join(adapter, bot.protocol)].schema(config)
    if (config.disabled) {
      bot.stop()
    } else {
      bot.start()
    }
  }

  removeBot(id: string) {
    const bot = this.ctx.bots.find(bot => bot.id === id)
    const index = bot.adapter.bots.indexOf(bot)
    const name = 'adapter-' + bot.adapter.platform
    this.plugins[name].bots.splice(index, 1)
    this.loader.writeConfig()
    return this.ctx.bots.remove(id)
  }
}
