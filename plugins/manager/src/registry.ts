import { App, Context, hyphenate, omit, Plugin, Schema } from 'koishi'
import { debounce } from 'throttle-debounce'
import { DataSource } from '@koishijs/plugin-console'
import {} from '@koishijs/cli'

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Sources {
      registry: RegistryProvider
    }
  }
}

export class RegistryProvider extends DataSource<RegistryProvider.Data[]> {
  cached: Promise<RegistryProvider.Data[]>
  promise: Promise<void>
  update = debounce(0, () => this.broadcast())

  static readonly placeholder = Symbol('status.registry.placeholder')

  constructor(ctx: Context) {
    super(ctx, 'registry')

    ctx.on('plugin-added', this.update)
    ctx.on('plugin-removed', this.update)
    ctx.on('disconnect', this.update.cancel)
  }

  async get(forced = false) {
    if (this.cached && !forced) return this.cached
    return this.cached = this.getForced()
  }

  private getState(plugin: Plugin) {
    return this.ctx.app.registry.get(plugin)
  }

  private async getForced() {
    const children: RegistryProvider.Data[] = [{
      id: null,
      name: null,
      schema: App.Config,
      config: omit(this.ctx.app.options, ['plugins' as any]),
    }]

    for (const plugin of this.getState(null).children) {
      const state = this.getState(plugin)
      const name = hyphenate(plugin.name)
      children.push({
        name,
        id: state.id,
        schema: state.schema,
        config: state.config,
      })
    }

    const { plugins = {} } = this.ctx.app.options
    for (const key in plugins) {
      if (!key.startsWith('~')) continue
      const name = hyphenate(key.slice(1))
      children.push({
        id: null,
        name,
        config: plugins[key],
      })
    }

    return children
  }

  async switch(id: string) {
    await this.promise
    for (const [plugin, state] of this.ctx.app.registry) {
      if (id !== state.id) continue
      const replacer = plugin[RegistryProvider.placeholder] || {
        apply: Object.assign(() => {}, {
          [RegistryProvider.placeholder]: state.plugin,
        }),
      }
      this.promise = this.ctx.dispose(plugin)
      state.context.plugin(replacer, state.config)
      break
    }
  }
}

export namespace RegistryProvider {
  export interface Data {
    id?: string
    name?: string
    schema?: Schema
    config?: any
  }
}
