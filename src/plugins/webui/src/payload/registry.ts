import { Context, Plugin } from 'koishi-core'

function debounce(callback: Function, ms: number) {
  let timer: number
  return function () {
    if (timer) clearTimeout(timer)
    timer = setTimeout(callback, ms)
  }
}

class Registry {
  cached: Promise<Registry.PluginData[]>
  promise: Promise<void>

  static readonly placeholder = Symbol('webui.registry.placeholder')
  static readonly webExtension = Symbol('webui.registry.web-extension')

  constructor(private ctx: Context, public config: Registry.Config) {
    ctx.on('plugin-added', this.update)
    ctx.on('plugin-removed', this.update)
  }

  update = debounce(async () => {
    this.ctx.webui.broadcast('registry', await this.get(true))
  }, 0)

  async get(forced = false) {
    if (this.cached && !forced) return this.cached
    return this.cached = this.getForced()
  }

  private async getForced() {
    return this.traverse(null).children
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

  traverse = (plugin: Plugin): Registry.PluginData => {
    const state = this.ctx.app.registry.get(plugin)
    let webExtension = state[Registry.webExtension]
    let complexity = plugin?.[Registry.placeholder] ? 0 : 1 + state.disposables.length
    const children: Registry.PluginData[] = []
    state.children.forEach((plugin) => {
      const data = this.traverse(plugin)
      complexity += data.complexity
      webExtension ||= data.webExtension
      if (data.name) {
        children.push(data)
      } else {
        children.push(...data.children)
      }
    })
    const { id, name, sideEffect } = state
    children.sort((a, b) => a.name > b.name ? 1 : -1)
    return { id, name, sideEffect, children, complexity, webExtension }
  }
}

namespace Registry {
  export interface Config {}

  export interface PluginData extends Plugin.Meta {
    id: string
    children: PluginData[]
    complexity: number
    webExtension: boolean
  }
}

export default Registry
