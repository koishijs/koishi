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

    ctx.console.addListener('plugin/unload', (name) => {
      this.unloadPlugin(name)
    })

    ctx.console.addListener('plugin/reload', (name, config) => {
      this.reloadPlugin(name, config)
    })

    ctx.console.addListener('plugin/save', (name, config) => {
      this.savePlugin(name, config)
    })

    ctx.console.addListener('bot/create', (platform, config) => {
      this.createBot(platform, config)
    })
  }

  writeConfig() {
    // prevent hot reload when it's being written
    const fileWatcher = this.ctx.fileWatcher
    fileWatcher && (fileWatcher.suspend = true)
    writeFileSync(this.loader.filename, dump(this.loader.config))
    fileWatcher && (fileWatcher.suspend = false)
  }

  async loadPlugin(name: string, config: any) {
    this.loader.loadPlugin(name, config)
    this.plugins[name] = config
    delete this.plugins['~' + name]
    this.writeConfig()
  }

  async unloadPlugin(name: string) {
    const plugin = this.loader.resolvePlugin(name)
    await this.ctx.dispose(plugin)
    this.plugins['~' + name] = this.plugins[name]
    delete this.plugins[name]
    this.writeConfig()
  }

  async reloadPlugin(name: string, config: any) {
    const plugin = this.loader.resolvePlugin(name)
    const state = this.ctx.app.registry.get(plugin)
    await this.ctx.dispose(plugin)
    state.context.plugin(plugin, config)
    this.plugins[name] = config
    this.writeConfig()
  }

  async savePlugin(name: string, config: any) {
    this.loader.resolvePlugin(name)
    this.plugins['~' + name] = config
    this.writeConfig()
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
    this.writeConfig()
  }

  async removeBot() {}

  async startBot() {}

  async stopBot() {}
}
