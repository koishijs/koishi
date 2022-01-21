import { camelize, capitalize, Context, Dict, Plugin } from 'koishi'
import { debounce } from 'throttle-debounce'
import { DataSource } from '@koishijs/plugin-console'

declare module '@koishijs/plugin-console' {
  interface Sources {
    registry: RegistryProvider
  }
}

export default class RegistryProvider extends DataSource<Dict<PluginData>> {
  static using = ['console'] as const

  private cache: Dict<PluginData>
  private timer = setInterval(() => this.update(), 1000)
  private update = debounce(0, () => {
    this.broadcast()
    this.timer.refresh()
  })

  constructor(ctx: Context) {
    super(ctx, 'registry')

    ctx.on('plugin-added', this.update)
    ctx.on('plugin-removed', this.update)
    ctx.on('service', this.update)
  }

  stop() {
    this.update.cancel()
    clearInterval(this.timer)
  }

  async get(forced = false) {
    if (this.cache && !forced) return this.cache
    this.cache = {}
    this.traverse(null)
    return this.cache
  }

  private traverse(plugin: Plugin) {
    const state = this.ctx.app.registry.get(plugin)
    this.cache[state.id] = {
      name: !plugin ? 'App'
        : !plugin.name || plugin.name === 'apply' ? ''
        : capitalize(camelize(plugin.name)),
      parent: state.parent?.id,
      disposables: state.disposables.length,
      dependencies: state.using.map(name => this.ctx[name]?.['ctx']?.state.id).filter(x => x),
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
