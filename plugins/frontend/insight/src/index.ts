import { camelize, capitalize, Context, Dict, Plugin, Schema } from 'koishi'
import { debounce } from 'throttle-debounce'
import { DataService } from '@koishijs/plugin-console'
import { resolve } from 'path'
import {} from '@koishijs/cli'

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Services {
      insight: Insight
    }
  }
}

function format(name: string) {
  return capitalize(camelize(name))
}

function getName(plugin: Plugin) {
  if (!plugin) return 'App'
  if (!plugin.name || plugin.name === 'apply') return 'Anonymous'
  return format(plugin.name)
}

function getSourceId(child: Plugin.Fork) {
  const { state } = child.parent
  if (state.runtime.isForkable) {
    return state.id
  } else {
    return state.runtime.id
  }
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

  async get() {
    const nodes: Insight.Node[] = []
    const edges: Insight.Link[] = []
    for (const runtime of this.ctx.app.registry.values()) {
      // exclude plugins that don't work due to missing dependencies
      const services = runtime.using.map(name => this.ctx[name])
      if (services.some(x => !x)) continue

      const ref = runtime.id
      const name = getName(runtime.plugin)
      const deps = new Set(services.map(({ ctx }) => {
        if (!ctx || ctx === ctx.app) return
        return ctx.state.id
      }).filter(x => x))

      // We divide plugins into three categories:
      // 1. fully reusable plugins
      //    will be displayed as A -> X, B -> Y
      // 2. partially reusable plugins
      //    will be displayed as A -> X -> M, B -> Y -> M
      // 3. non-reusable plugins
      //    will be displayed as A -> M, B -> M
      // where A, B: parent plugin states
      //       X, Y: target fork states
      //       M:    target main state
      // Service dependencies will be connected from the last node of each path

      function addNode(state: Plugin.State) {
        const { id, alias, disposables } = state
        const weight = disposables.length
        const node = { id, ref, name, weight }
        if (alias) node.name += ` <${format(alias)}>`
        nodes.push(node)
      }

      function addEdge(type: 'dashed' | 'solid', source: string, target: string) {
        edges.push({ type, source, target })
      }

      const isReusable = runtime.plugin?.['reusable']
      if (!isReusable) {
        addNode(runtime)
        for (const target of deps) {
          addEdge('dashed', runtime.id, target)
        }
      }

      for (const fork of runtime.children) {
        if (runtime.isForkable) {
          addNode(fork)
          addEdge('solid', getSourceId(fork), fork.id)
          if (!isReusable) {
            addEdge('solid', fork.id, runtime.id)
          } else {
            for (const target of deps) {
              addEdge('dashed', fork.id, target)
            }
          }
        } else {
          nodes[nodes.length - 1].weight += fork.disposables.length
          addEdge('solid', getSourceId(fork), runtime.id)
        }
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
    ref: string
    name: string
    weight: number
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
