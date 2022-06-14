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
    return state.uid
  } else {
    return state.runtime.uid
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
    //   const data = this.nodes[runtime.uid]
    //   if (!data) continue
    //   if (runtime.disposables.length !== data.disposables) {
    //     data.disposables = runtime.disposables.length
    //     payload[runtime.uid] = data
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

      const rid = runtime.uid
      const name = getName(runtime.plugin)
      const deps = new Set(services.map(({ ctx }) => {
        if (!ctx || ctx === ctx.app) return
        return ctx.state.uid
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
        const { uid, alias, disposables } = state
        const weight = disposables.length
        const node = { uid, rid, name, weight }
        if (alias) node.name += ` <${format(alias)}>`
        nodes.push(node)
      }

      function addEdge(type: 'dashed' | 'solid', source: number, target: number) {
        edges.push({ type, source, target })
      }

      const isReusable = runtime.plugin?.['reusable']
      if (!isReusable) {
        addNode(runtime)
        for (const target of deps) {
          addEdge('dashed', runtime.uid, target)
        }
      }

      for (const fork of runtime.children) {
        if (runtime.isForkable) {
          addNode(fork)
          addEdge('solid', getSourceId(fork), fork.uid)
          if (!isReusable) {
            addEdge('solid', fork.uid, runtime.uid)
          } else {
            for (const target of deps) {
              addEdge('dashed', fork.uid, target)
            }
          }
        } else {
          nodes[nodes.length - 1].weight += fork.disposables.length
          addEdge('solid', getSourceId(fork), runtime.uid)
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
    uid: number
    rid: number
    name: string
    weight: number
  }

  export interface Link {
    type: 'solid' | 'dashed'
    source: number
    target: number
  }

  export const using = ['console'] as const

  export interface Config {}

  export const Config: Schema<Config> = Schema.object({})
}

export default Insight
