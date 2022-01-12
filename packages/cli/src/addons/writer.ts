import { App, Context, Service } from 'koishi'
import { writeFileSync } from 'fs'
import { dump } from 'js-yaml'
import { Loader } from '../loader'

Context.service('configWriter')

export default class ConfigWriter extends Service {
  private allowWrite: boolean
  private loader: Loader
  private config: App.Config

  constructor(ctx: Context) {
    super(ctx, 'configWriter')
    this.loader = ctx.app.loader
    this.config = ctx.app.options
    this.allowWrite = this.config.allowWrite && ['.yml', '.yaml'].includes(this.loader.extname)
  }

  writeConfig() {
    if (!this.allowWrite) return
    writeFileSync(this.loader.filename, dump(this.config))
  }

  async loadPlugin(name: string, config: any) {
    this.loader.loadPlugin(name, config)
    this.config.plugins[name] = config
    delete this.config.plugins['~' + name]
    this.writeConfig()
  }

  async unloadPlugin(name: string) {
    const plugin = this.loader.resolvePlugin(name)
    await this.ctx.dispose(plugin)
    this.config.plugins['~' + name] = this.config.plugins[name]
    delete this.config.plugins[name]
    this.writeConfig()
  }

  async reloadPlugin(name: string, config: any) {
    const plugin = this.loader.resolvePlugin(name)
    const state = this.ctx.app.registry.get(plugin)
    await this.ctx.dispose(plugin)
    state.context.plugin(plugin, config)
    this.config.plugins[name] = config
    this.writeConfig()
  }

  async savePlugin(name: string, config: any) {
    this.loader.resolvePlugin(name)
    this.config.plugins['~' + name] = config
    this.writeConfig()
  }

  async createBot(platform: string, config: any) {
    const name = 'adapter-' + platform
    if (this.config.plugins['~' + name]) {
      this.config.plugins[name] = this.config.plugins['~' + name]
      delete this.config.plugins['~' + name]
    } else if (!this.config.plugins[name]) {
      this.config.plugins[name] = { bots: [] }
    }
    const adapterConfig = this.config.plugins[name]
    adapterConfig['bots'].push(config)
    this.loader.loadPlugin(name, adapterConfig)
    this.writeConfig()
  }

  async removeBot() {}

  async startBot() {}

  async stopBot() {}
}
