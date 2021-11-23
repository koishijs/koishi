import { camelize, capitalize, Context, Plugin } from 'koishi'
import { debounce } from 'throttle-debounce'
import { DataSource } from '@koishijs/plugin-console'
import {} from '@koishijs/cli'

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Sources {
      registry: RegistryProvider
    }

    interface Events {
      switch(name: string): Promise<void>
    }
  }
}

const placeholder = Symbol('status.registry.placeholder')

export class RegistryProvider extends DataSource<PluginData> {
  cached: PluginData
  promise: Promise<void>
  update = debounce(0, () => this.broadcast())

  constructor(ctx: Context) {
    super(ctx, 'registry')

    ctx.on('plugin-added', this.update)
    ctx.on('plugin-removed', this.update)
    ctx.on('disconnect', this.update.cancel)

    ctx.console.addListener('switch', this.switch)
  }

  async get(forced = false) {
    if (this.cached && !forced) return this.cached
    return this.cached = this.traverse(null)
  }

  private traverse(plugin: Plugin): PluginData {
    const state = this.ctx.app.registry.get(plugin)
    let complexity = plugin?.[placeholder] ? 0 : 1 + state.disposables.length
    const children: PluginData[] = []
    for (const child of state.children) {
      const data = this.traverse(child)
      complexity += data.complexity
      children.push(data)
    }
    const name = !plugin ? 'App'
      : !plugin.name || plugin.name === 'apply' ? ''
      : capitalize(camelize(plugin.name))
    return { id: state.id || '', name, complexity, children }
  }

  switch = async (id: string) => {
    await this.promise
    for (const [plugin, state] of this.ctx.app.registry) {
      if (id !== state.id) continue
      const replacer = plugin[placeholder] || {
        apply: Object.assign(() => {}, {
          [placeholder]: state.plugin,
        }),
      }
      this.promise = this.ctx.dispose(plugin)
      state.context.plugin(replacer, state.config)
      break
    }
  }
}

export interface PluginData {
  id: string
  name: string
  complexity: number
  children: PluginData[]
}
