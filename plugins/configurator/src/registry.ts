import { App, Context, hyphenate, omit, pick, Plugin, Schema, Modules, Dict, Adapter } from 'koishi'
import { debounce } from 'throttle-debounce'
import { DataSource } from '@koishijs/plugin-console'
import {} from '@koishijs/cli'

declare module '@koishijs/plugin-console' {
  namespace DataSource {
    interface Library {
      registry: RegistrySource
    }
  }
}

export class RegistrySource implements DataSource<Dict<RegistrySource.Data>> {
  cached: Promise<Dict<RegistrySource.Data>>
  promise: Promise<void>

  static readonly placeholder = Symbol('status.registry.placeholder')

  constructor(private ctx: Context, public config: RegistrySource.Config) {
    ctx.on('plugin-added', this.update)
    ctx.on('plugin-removed', this.update)
  }

  update = debounce(0, async () => {
    this.ctx.webui.broadcast('data', {
      key: 'registry',
      value: await this.get(true),
    })
  })

  async get(forced = false) {
    if (this.cached && !forced) return this.cached
    return this.cached = this.getForced()
  }

  private getState(plugin: Plugin) {
    return this.ctx.app.registry.get(plugin)
  }

  private async getForced() {
    const children: RegistrySource.Data[] = [{
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
      const replacer = plugin[RegistrySource.placeholder] || {
        name: state.name,
        apply: Object.assign(() => {}, {
          [RegistrySource.placeholder]: state.plugin,
        }),
      }
      this.promise = this.ctx.dispose(plugin)
      state.context.plugin(replacer, state.config)
      break
    }
  }
}

export namespace RegistrySource {
  export interface Config {}

  export interface Data {
    id?: string
    name?: string
    schema?: Schema
    config?: any
  }
}
