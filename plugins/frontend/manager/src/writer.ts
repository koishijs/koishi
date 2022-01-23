import { Context } from 'koishi'
import { writeFileSync } from 'fs'
import { dump } from 'js-yaml'
import { Loader } from '@koishijs/cli'

export default class ConfigWriter {
  private loader: Loader
  private plugins: {}

  constructor(private ctx: Context) {
    this.loader = ctx.app.loader
    this.plugins = this.loader.config.plugins

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
    const plugin = this.loader.resolvePlugin(name)
    const state = this.ctx.dispose(plugin)
    if (state) {
      state.context.plugin(plugin, config)
    } else {
      this.ctx.app.plugin(plugin, config)
    }
    delete this.plugins['~' + name]
    this.plugins[name] = config
    this.loader.writeConfig()
  }

  unloadPlugin(name: string, config: any) {
    const plugin = this.loader.resolvePlugin(name)
    this.ctx.dispose(plugin)
    delete this.plugins[name]
    this.plugins['~' + name] = config
    this.loader.writeConfig()
  }

  async createBot(platform: string, config: any) {
    const name = 'adapter-' + platform
    if (this.plugins['~' + name]) {
      this.plugins[name] = this.plugins['~' + name]
      delete this.plugins['~' + name]
    } else if (!this.plugins[name]) {
      this.plugins[name] = { bots: [] }
    }
    const adapterConfig = this.plugins[name]
    adapterConfig['bots'].push(config)
    this.loader.loadPlugin(name, adapterConfig)
    this.loader.writeConfig()
  }

  async removeBot() {}

  async startBot() {}

  async stopBot() {}
}
