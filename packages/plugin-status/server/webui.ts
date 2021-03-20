import { Context, Plugin, noop } from 'koishi-core'
import { resolve, extname } from 'path'
import { promises as fs, Stats, createReadStream } from 'fs'
import { WebAdapter } from './adapter'
import type * as Vite from 'vite'
import type PluginVue from '@vitejs/plugin-vue'
import Profile from './profile'
import Statistics from './stats'

export { BotData, LoadRate } from './profile'

export interface Config extends WebAdapter.Config, Profile.Config {
  selfUrl?: string
  uiPath?: string
  devMode?: boolean
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
  const { apiPath, uiPath, devMode, selfUrl } = config

  const globalVariables = Object.entries({
    KOISHI_UI_PATH: uiPath,
    KOISHI_ENDPOINT: selfUrl + apiPath,
  }).map(([key, value]) => `window.${key} = ${JSON.stringify(value)};`).join('\n')

  const root = resolve(__dirname, '..', devMode ? 'client' : 'dist')

  async function createVite() {
    if (!devMode) return

    const { createServer } = require('vite') as typeof Vite
    const pluginVue = require('@vitejs/plugin-vue').default as typeof PluginVue

    const vite = await createServer({
      root,
      base: '/vite/',
      server: { middlewareMode: true },
      plugins: [pluginVue()],
      resolve: {
        alias: {
          '~/client': root,
          '~/variables': root + '/index.scss',
        },
      },
    })

    ctx.router.all('/vite(/.+)+', (koa) => new Promise((resolve) => {
      vite.middlewares(koa.req, koa.res, resolve)
    }))

    ctx.before('disconnect', () => vite.close())

    return vite
  }

  async function createAdapter() {
    const adapter = ctx.app.adapters.web = new WebAdapter(ctx, config)

    adapter.server.on('connection', async (socket) => {
      function send(type: string, body: any) {
        socket.send(JSON.stringify({ type, body }))
      }

      Statistics.get(ctx).then(data => send('stats', data))
      getProfile().then(data => send('profile', data))
      send('registry', getRegistry())
    })

    await adapter.start()

    ctx.before('disconnect', () => adapter.stop())

    ctx.on('registry', () => {
      adapter.broadcast('registry', getRegistry(true))
    })

    ctx.on('status/tick', async () => {
      adapter.broadcast('profile', await getProfile(true))
    })

    return adapter
  }

  ctx.on('connect', async () => {
    const [vite] = await Promise.all([createVite(), createAdapter()])

    ctx.router.get(uiPath + '(/.+)*', async (koa) => {
      const filename = resolve(root, koa.path.slice(uiPath.length).replace(/^\/+/, ''))
      if (!filename.startsWith(root) && !filename.includes('node_modules')) {
        return koa.status = 403
      }
      const stats = await fs.stat(filename).catch<Stats>(noop)
      if (stats?.isFile()) {
        koa.type = extname(filename)
        return koa.body = createReadStream(filename)
      }
      let template = await fs.readFile(resolve(root, 'index.html'), 'utf8')
      if (vite) template = await vite.transformIndexHtml(uiPath, template)
      koa.set('content-type', 'text/html')
      koa.body = template.replace('</head>', '<script>' + globalVariables + '</script></head>')
    })
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
    registry.pluginCount += 1
    const dependencies = [...new Set(getDeps(state))]
    return [{ name, sideEffect, children, dependencies }]
  }

  let profile: Promise<Profile>
  function getProfile(forced = false) {
    if (profile && !forced) return profile
    return profile = Profile.get(ctx, config)
  }

  let registry: Registry
  function getRegistry(forced = false) {
    if (registry && !forced) return registry
    registry = { pluginCount: 0 } as Registry
    registry.plugins = traverse(null)
    return registry
  }
}
