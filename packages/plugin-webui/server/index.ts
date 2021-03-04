import { Context, Plugin } from 'koishi-core'
import { assertProperty } from 'koishi-utils'
import { resolve } from 'path'
import { createServer, ViteDevServer } from 'vite'
import vuePlugin from '@vitejs/plugin-vue'

declare module 'koishi-core' {
  interface App {
    vite: ViteDevServer
  }
}

export interface Config {
  port?: number
  server?: string
}

export interface PluginData {
  name: string
  sideEffect: boolean
  children: PluginData[]
}

export const name = 'webui'

export function apply(ctx: Context, config: Config = {}) {
  const koishiPort = assertProperty(ctx.app.options, 'port')
  const { port = 8080, server = `http://localhost:${koishiPort}` } = config

  ctx.on('connect', async () => {
    const vite = await createServer({
      root: resolve(__dirname, '../client'),
      plugins: [vuePlugin()],
      define: {
        KOISHI_SERVER: JSON.stringify(server),
      },
    })

    await vite.listen(port)
    ctx.app.vite = vite
  })

  function traverse(plugin: Plugin): PluginData[] {
    const state = ctx.app.registry.get(plugin)
    const children = state.children.flatMap(traverse, 1)
    if (typeof plugin === 'function' || !plugin?.name) return children
    const { name } = plugin, { sideEffect } = state
    return [{ name, sideEffect, children }]
  }

  ctx.router.get('/plugins', (ctx) => {
    ctx.set('access-control-allow-origin', '*')
    ctx.body = traverse(null)
  })

  ctx.on('registry', () => {
    ctx.app.vite?.ws.send({
      type: 'custom',
      event: 'registry-update',
      data: traverse(null),
    })
  })

  ctx.before('disconnect', async () => {
    await ctx.app.vite?.close()
  })
}
