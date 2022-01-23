import { Context } from 'koishi'
import { Loader } from '@koishijs/cli'

export default class ConfigWriter {
  private loader: Loader
  private plugins: {}

  constructor(private ctx: Context) {
    this.loader = ctx.loader
    this.plugins = ctx.loader.config.plugins

    ctx.console.addListener('plugin/load', (name, config) => {
      this.loadPlugin(name, config)
    })

    ctx.console.addListener('plugin/unload', (name, config) => {
      this.unloadPlugin(name, config)
    })

    ctx.console.addListener('bot/create', (platform, config) => {
      this.createBot(platform, config)
    })
  }

  loadPlugin(name: string, config: any) {
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

  async createBot(platform: string, config: any) {
    const name = 'adapter-' + platform
    if (this.plugins['~' + name]) {
      this.plugins[name] = this.plugins['~' + name]
      delete this.plugins['~' + name]
    } else if (!this.plugins[name]) {
      this.plugins[name] = { bots: [] }
    }
    this.plugins[name].bots.push(config)
    this.loader.writeConfig()
    this.loader.reloadPlugin(name)
  }

  async removeBot() {}

  async startBot() {}

  async stopBot() {}
}
