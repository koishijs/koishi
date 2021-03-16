import { Context, Plugin } from 'koishi-core'
import { assertProperty } from 'koishi-utils'
import { resolve } from 'path'
import { WebAdapter } from './adapter'
import { createServer, ViteDevServer } from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
import Profile from './profile'
import Statistics from './stats'

export { BotData, LoadRate } from './profile'

export interface Config extends WebAdapter.Config {
  port?: number
  selfUrl?: string
}

export interface PluginData extends Plugin.Meta {
  children: PluginData[]
  dependencies: string[]
}

export interface Payload extends Profile, Statistics {
  plugins: PluginData[]
  pluginCount: number
}

export const name = 'webui'

export function apply(ctx: Context, config: Config = {}) {
  const root = resolve(__dirname, '../client')
  const koishiPort = assertProperty(ctx.app.options, 'port')
  const {
    path = '/status',
    port = 8080,
    selfUrl = `ws://localhost:${koishiPort}`,
  } = config

  let vite: ViteDevServer
  let adapter: WebAdapter
  ctx.on('connect', async () => {
    vite = await createServer({
      root,
      plugins: [vuePlugin()],
      resolve: {
        alias: {
          '~/client': root,
        },
      },
      define: {
        KOISHI_ENDPOINT: JSON.stringify(selfUrl + path),
      },
    })

    adapter = ctx.app.adapters.sandbox = new WebAdapter(ctx.app, { path })

    adapter.server.on('connection', async (socket) => {
      if (!plugins) updatePlugins()
      if (!profile) await updateProfile()
      const data = JSON.stringify({
        type: 'update',
        body: { ...profile, plugins, pluginCount },
      })
      socket.send(data)
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
    pluginCount += 1
    const dependencies = [...new Set(getDeps(state))]
    return [{ name, sideEffect, children, dependencies }]
  }

  let plugins: PluginData[]
  let pluginCount: number
  let profile: Profile

  async function broadcast(callback: () => void | Promise<void>) {
    if (!adapter?.server.clients.size) return
    await callback()
    const data = JSON.stringify({
      type: 'update',
      body: { ...profile, plugins, pluginCount },
    })
    adapter.server.clients.forEach((socket) => socket.send(data))
  }

  function updatePlugins() {
    pluginCount = 0
    plugins = traverse(null)
  }

  async function updateProfile() {
    profile = await Profile.from(ctx)
    await Statistics.patch(ctx, profile)
  }

  ctx.on('registry', () => {
    broadcast(updatePlugins)
  })

  ctx.on('status/tick', () => {
    broadcast(updateProfile)
  })

  ctx.before('disconnect', async () => {
    await Promise.all([
      vite?.close(),
      adapter?.stop(),
    ])
  })
}
