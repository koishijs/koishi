import { Context, Plugin } from 'koishi-core'
import { assertProperty } from 'koishi-utils'
import { resolve } from 'path'
import { createServer, ViteDevServer } from 'vite'
import WebSocket from 'ws'
import vuePlugin from '@vitejs/plugin-vue'
import Profile from './profile'
import Statistics from './stats'

export { BotData, LoadRate } from './profile'

export interface Config {
  path?: string
  port?: number
  selfUrl?: string
  layout?: string
}

export interface PluginData extends Plugin.Meta {
  children: PluginData[]
  dependencies: string[]
}

export interface Payload extends Profile, Statistics {
  plugins: PluginData[]
}

export const name = 'webui'

export function apply(ctx: Context, config: Config = {}) {
  const root = resolve(__dirname, '../client')
  const koishiPort = assertProperty(ctx.app.options, 'port')
  const {
    path = '/status',
    port = 8080,
    layout = root + '/app.vue',
    selfUrl = `ws://localhost:${koishiPort}`,
  } = config

  let vite: ViteDevServer
  let wsServer: WebSocket.Server
  ctx.on('connect', async () => {
    vite = await createServer({
      root,
      plugins: [vuePlugin()],
      resolve: {
        alias: {
          '~/client': root,
          '~/layout': resolve(process.cwd(), layout),
        },
      },
      define: {
        KOISHI_ENDPOINT: JSON.stringify(selfUrl + path),
      },
    })

    wsServer = new WebSocket.Server({
      path,
      server: ctx.app._httpServer,
    })

    wsServer.on('connection', async (socket) => {
      if (!plugins) updatePlugins()
      if (!profile) await updateProfile()
      const data = JSON.stringify({
        type: 'update',
        body: { ...profile, plugins },
      })
      socket.send(data)
    })

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
    const dependencies = [...new Set(getDeps(state))]
    return [{ name, sideEffect, children, dependencies }]
  }

  let plugins: PluginData[]
  let profile: Profile

  async function broadcast(callback: () => void | Promise<void>) {
    if (!wsServer?.clients.size) return
    await callback()
    const data = JSON.stringify({
      type: 'update',
      body: { ...profile, plugins },
    })
    wsServer.clients.forEach((socket) => socket.send(data))
  }

  function updatePlugins() {
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
      new Promise<void>((resolve, reject) => {
        wsServer.close((err) => err ? resolve() : reject(err))
      }),
    ])
  })
}
