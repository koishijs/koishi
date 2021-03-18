import { Context, Plugin } from 'koishi-core'
import { assertProperty } from 'koishi-utils'
import { resolve } from 'path'
import { WebAdapter } from './adapter'
import { createServer, ViteDevServer } from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
import Profile from './profile'
import Statistics from './stats'

export { BotData, LoadRate } from './profile'

export interface Config extends WebAdapter.Config, Profile.Config {
  port?: number
  selfUrl?: string
}

export interface PluginData extends Plugin.Meta {
  children: PluginData[]
  dependencies: string[]
}

export { Statistics, Profile }

export interface Registry {
  plugins: PluginData[]
  pluginCount: number
}

export const name = 'webui'

export function apply(ctx: Context, config: Config = {}) {
  const root = resolve(__dirname, '../client')
  const koishiPort = assertProperty(ctx.app.options, 'port')
  const { path, port, selfUrl = `http://localhost:${koishiPort}` } = config

  let vite: ViteDevServer
  let adapter: WebAdapter
  ctx.on('connect', async () => {
    vite = await createServer({
      root,
      plugins: [vuePlugin()],
      resolve: {
        alias: {
          '~/client': root,
          '~/variables': root + '/index.scss',
        },
      },
      define: {
        KOISHI_ENDPOINT: JSON.stringify(selfUrl + path),
      },
    })

    adapter = ctx.app.adapters.sandbox = new WebAdapter(ctx, config)

    adapter.server.on('connection', async (socket) => {
      function send(type: string, body: any) {
        socket.send(JSON.stringify({ type, body }))
      }

      Statistics.get(ctx).then(data => send('stats', data))
      getProfile().then(data => send('profile', data))
      send('registry', getRegistry())
    })

    await adapter.start()
    await vite.listen(port)
  })

  function* getDeps(state: Plugin.State): Generator<string> {
    for (const dep of state.dependencies) {
      if (dep.name) {
        yield dep.name
      } else {
        yield* getDeps(dep)
      }
    }
  }

  function traverse(plugin: Plugin): PluginData[] {
    const state = ctx.app.registry.get(plugin)
    const children = state.children.flatMap(traverse, 1)
    const { name, sideEffect } = state
    if (!name) return children
    internal.pluginCount += 1
    const dependencies = [...new Set(getDeps(state))]
    return [{ name, sideEffect, children, dependencies }]
  }

  let profile: Promise<Profile>
  let internal: Registry

  async function broadcast(type: string, body: any) {
    if (!adapter?.server.clients.size) return
    const data = JSON.stringify({ type, body })
    adapter.server.clients.forEach((socket) => socket.send(data))
  }

  function getRegistry(forced = false) {
    if (internal && !forced) return internal
    internal = { pluginCount: 0 } as Registry
    internal.plugins = traverse(null)
    return internal
  }

  function getProfile(forced = false) {
    if (profile && !forced) return profile
    return profile = Profile.get(ctx, config)
  }

  ctx.on('registry', () => {
    broadcast('registry', getRegistry(true))
  })

  ctx.on('status/tick', async () => {
    broadcast('profile', await getProfile(true))
  })

  ctx.before('disconnect', async () => {
    await Promise.all([
      vite?.close(),
      adapter?.stop(),
    ])
  })
}
