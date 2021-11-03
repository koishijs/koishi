import { App, Context, hyphenate, omit, pick, Plugin, Schema, Modules, Dict } from 'koishi'
import { debounce } from 'throttle-debounce'
import { DataSource } from '@koishijs/plugin-console'
import {} from '@koishijs/cli'

declare module '@koishijs/plugin-console' {
  namespace DataSource {
    interface Library {
      registry: RegistryProvider
    }
  }
}

export class RegistryProvider extends DataSource<Dict<RegistryProvider.Data>> {
  cached: Promise<Dict<RegistryProvider.Data>>
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
      name: '',
      schema: App.Config,
      config: omit(this.ctx.app.options, ['plugins' as any]),
    }]

    for (const plugin of this.getState(null).children) {
      const state = this.getState(plugin)
      if (!state.name) continue
      children.push(pick(state, ['id', 'name', 'schema', 'config']))
    }

    const { plugins = {} } = this.ctx.app.options
    for (const key in plugins) {
      if (!key.startsWith('~')) continue
      const name = hyphenate(key.slice(1))
      const { schema } = require(Modules.resolve(name))
      children.push({
        id: null,
        name,
        schema,
        config: plugins[key],
      })
    }

    return Object.fromEntries(children.map(data => [data.name, data]))
  }

  async switch(id: string) {
    await this.promise
    for (const [plugin, state] of this.ctx.app.registry) {
      if (id !== state.id) continue
      const replacer = plugin[RegistryProvider.placeholder] || {
        name: state.name,
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
