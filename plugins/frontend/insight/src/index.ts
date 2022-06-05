import { camelize, capitalize, Context, Dict, Plugin, Schema } from 'koishi'
import { debounce } from 'throttle-debounce'
import { DataService } from '@koishijs/plugin-console'
import { resolve } from 'path'

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Services {
      insight: Insight
    }
  }
}

function getName(plugin: Plugin) {
  if (!plugin) return 'App'
  if (!plugin.name || plugin.name === 'apply') return 'Anonymous'
  return capitalize(camelize(plugin.name))
}

class Insight extends DataService<Insight.Payload> {
  private nodes: Dict<Insight.Node>

  constructor(ctx: Context) {
    super(ctx, 'insight')

    ctx.console.addEntry({
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist'),
    })

    ctx.on('plugin-added', this.update)
    ctx.on('plugin-removed', this.update)
    ctx.on('internal/service', this.update)
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
    // if (!this.nodes) return
    // for (const [, runtime] of this.ctx.app.registry) {
    //   const data = this.nodes[runtime.id]
    //   if (!data) continue
    //   if (runtime.disposables.length !== data.disposables) {
    //     data.disposables = runtime.disposables.length
    //     payload[runtime.id] = data
    //   }
    // }
    // if (Object.keys(payload).length) this.patch(payload)
  }, 1000)

  get() {
    const nodes: Insight.Node[] = []
    const edges: Insight.Link[] = []
    for (const runtime of this.ctx.app.registry.values()) {
      const services = runtime.using.map(name => this.ctx[name])
      if (services.some(x => !x)) continue
      nodes.push({
        id: runtime.id,
        name: getName(runtime.plugin),
        weight: runtime.disposables.length,
        forks: runtime.children.map(child => child.disposables.length),
      })
      for (const child of runtime.children) {
        edges.push({
          type: 'solid',
          source: child.parent.state.runtime.id,
          target: runtime.id,
        })
      }
      for (const service of services) {
        const ctx = service.ctx
        if (!ctx || ctx === ctx.app) continue
        edges.push({
          type: 'dashed',
          source: runtime.id,
          target: ctx.state.id,
        })
      }
    }
    return { nodes, edges }
  }
}

namespace Insight {
  export interface Payload {
    nodes: Node[]
    edges: Link[]
  }

  export interface Node {
    id: string
    name: string
    weight: number
    forks: number[]
  }

  export interface Link {
    type: 'solid' | 'dashed'
    source: string
    target: string
  }

  export const using = ['console'] as const

  export interface Config {}

  export const Config: Schema<Config> = Schema.object({})
}

export default Insight
