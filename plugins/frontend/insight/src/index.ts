import { camelize, capitalize, Context, Dict, Plugin } from 'koishi'
import { debounce } from 'throttle-debounce'
import { DataService } from '@koishijs/plugin-console'
import { resolve } from 'path'

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Services {
      registry: RegistryProvider
    }
  }
}

export default class RegistryProvider extends DataService<Dict<PluginData>> {
  static using = ['console'] as const

  private cache: Dict<PluginData>

  constructor(ctx: Context) {
    super(ctx, 'registry')

    const filename = ctx.console.config.devMode ? '../client/index.ts' : '../dist/index.js'
    ctx.console.addEntry(resolve(__dirname, filename))

    ctx.on('plugin-added', this.update)
    ctx.on('plugin-removed', this.update)
    ctx.on('service', this.update)
  }

  stop() {
    this.update.cancel()
    clearInterval(this.timer)
  }

  private update = debounce(0, () => {
    this.timer.refresh()
    this.refresh()
  })

  private timer = setInterval(() => {
    if (!this.cache) return
    const patch: Dict<PluginData> = {}
    for (const [, state] of this.ctx.app.registry) {
      const data = this.cache[state.id]
      if (!data) continue
      if (state.disposables.length !== data.disposables) {
        data.disposables = state.disposables.length
        patch[state.id] = data
      }
    }
    if (Object.keys(patch).length) this.patch(patch)
  }, 1000)

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
