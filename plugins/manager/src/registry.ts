import { camelize, capitalize, Context, Dict, Plugin } from 'koishi'
import { debounce } from 'throttle-debounce'
import { DataSource } from '@koishijs/plugin-console'
import {} from '@koishijs/cli'

export class RegistryProvider extends DataSource<Dict<PluginData>> {
  cached: Dict<PluginData>
  promise: Promise<void>
  update = debounce(0, () => this.broadcast())

  constructor(ctx: Context) {
    super(ctx, 'registry')

    ctx.on('plugin-added', this.update)
    ctx.on('plugin-removed', this.update)
    ctx.on('disconnect', this.update.cancel)
  }

  async get(forced = false) {
    if (this.cached && !forced) return this.cached
    this.cached = {}
    this.traverse(null)
    return this.cached
  }

  private traverse(plugin: Plugin) {
    const state = this.ctx.app.registry.get(plugin)
    this.cached[state.id] = {
      name: !plugin ? 'App'
        : !plugin.name || plugin.name === 'apply' ? ''
        : capitalize(camelize(plugin.name)),
      parent: state.parent?.id,
      disposables: state.disposables.length,
      dependencies: state.using.map(name => this.ctx.app._services[name]),
    }
    for (const child of state.children) {
      this.traverse(child)
    }
  }
}

export interface PluginData {
  name: string
  parent: string
  disposables: number
  dependencies: string[]
}
