import { App, Context, hyphenate, omit, pick, Plugin, Schema, Module, Dict, Adapter, Bot } from 'koishi'
import { debounce } from 'throttle-debounce'
import { StatusServer } from '../server'

class Registry implements StatusServer.DataSource {
  cached: Promise<Registry.Payload>
  promise: Promise<void>

  static readonly placeholder = Symbol('status.registry.placeholder')
  static readonly webExtension = Symbol('status.registry.web-extension')

  constructor(private ctx: Context, public config: Registry.Config) {
    ctx.on('plugin-added', this.update)
    ctx.on('plugin-removed', this.update)
  }

  update = debounce(0, async () => {
    this.ctx.webui.broadcast('registry', await this.get(true))
  })

  async get(forced = false) {
    if (this.cached && !forced) return this.cached
    return this.cached = this.getForced()
  }

  private getState(plugin: Plugin) {
    return this.ctx.app.registry.get(plugin)
  }

  private async getForced() {
    // get protocols
    const protocols: Dict<Schema> = {}
    for (const key in Adapter.library) {
      protocols[key] = Adapter.library[key].schema
    }

    const providing = (['assets', 'cache', 'database'] as const).filter(key => this.ctx[key])
    const children: Registry.Data[] = [{
      id: null,
      name: '',
      schema: App.Config,
      protocols,
      delegates: { providing },
      config: omit(this.ctx.app.options, ['plugins' as any]),
    } as Registry.AppData]

    for (const plugin of this.getState(null).children) {
      const state = this.getState(plugin)
      if (!state.name) continue
      children.push(pick(state, ['id', 'name', 'schema', 'delegates', 'config']))
    }

    const { plugins = {} } = this.ctx.app.options
    for (const key in plugins) {
      if (!key.startsWith('~')) continue
      const name = hyphenate(key.slice(1))
      const { schema, delegates } = require(Module.resolve(name))
      children.push({
        id: null,
        name,
        schema,
        delegates,
        config: plugins[key],
      })
    }

    return Object.fromEntries(children.map(data => [data.name, data]))
  }

  async switch(id: string) {
    await this.promise
    for (const [plugin, state] of this.ctx.app.registry) {
      if (id !== state.id) continue
      const replacer = plugin[Registry.placeholder] || {
        name: state.name,
        apply: Object.assign(() => {}, {
          [Registry.placeholder]: state.plugin,
        }),
      }
      this.promise = this.ctx.dispose(plugin)
      state.context.plugin(replacer, state.config)
      break
    }
  }
}

namespace Registry {
  export interface Config {}

  export interface Payload extends Dict<Data> {
    ''?: AppData
  }

  export interface Data {
    id?: string
    name?: string
    schema?: Schema
    delegates?: Context.Delegates.Meta
    config?: any
  }

  export interface AppData extends Data {
    protocols: Dict<Schema>
  }
}

export default Registry
