import { camelize, capitalize, Context, Dict, Fork, Plugin, Schema, State } from 'koishi'
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

function getSourceId(child: Fork) {
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

    ctx.on('internal/fork', this.update)
    ctx.on('internal/runtime', this.update)
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
      // Suppose we have the following types of nodes:
      // - A, B: parent plugin states
      // - X, Y: target fork states
      // - M:    target main state
      // - S:    service dependencies

      // We can divide plugins into three categories:
      // 1. fully reusable plugins
      //    will be displayed as A -> X -> S, B -> Y -> S
      // 2. partially reusable plugins
      //    will be displayed as A -> X -> M -> S, B -> Y -> M -> S
      // 3. non-reusable plugins
      //    will be displayed as A -> M -> S, B -> M -> S

      function isActive(state: State) {
        // exclude plugins that don't work due to missing dependencies
        return runtime.using.every(name => state.context[name])
      }

      const name = getName(runtime.plugin)

      function addNode(state: State) {
        const { uid, alias, disposables } = state
        const weight = disposables.length
        const node = { uid, name, weight }
        if (alias) node.name += ` <${format(alias)}>`
        nodes.push(node)
      }

      function addEdge(type: 'dashed' | 'solid', source: number, target: number) {
        edges.push({ type, source, target })
      }

      function addDeps(state: State) {
        for (const name of runtime.using) {
          const ctx = state.context[name][Context.source]
          const uid = ctx?.state.uid
          if (!uid) continue
          addEdge('dashed', state.uid, uid)
        }
      }

      const isReusable = runtime.plugin?.['reusable']
      if (!isReusable) {
        if (!isActive(runtime)) continue
        addNode(runtime)
        addDeps(runtime)
      }

      for (const fork of runtime.children) {
        if (runtime.isForkable) {
          if (!isActive(fork)) continue
          addNode(fork)
          addEdge('solid', getSourceId(fork), fork.uid)
          if (!isReusable) {
            addEdge('solid', fork.uid, runtime.uid)
          } else {
            addDeps(fork)
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
