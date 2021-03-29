import { Context, noop, snakeCase } from 'koishi-core'
import { resolve, extname } from 'path'
import { promises as fs, Stats, createReadStream } from 'fs'
import { WebAdapter } from './adapter'
import { DataSource, Profile, Meta, Registry } from './data'
import { Statistics } from './stats'
import type * as Vite from 'vite'
import type PluginVue from '@vitejs/plugin-vue'

export namespace WebServer {
  export interface Config extends WebAdapter.Config, Profile.Config, Meta.Config, Registry.Config, Statistics.Config {
    title?: string
    selfUrl?: string
    uiPath?: string
    devMode?: boolean
  }

  export interface Global {
    title: string
    uiPath: string
    endpoint: string
    devMode: boolean
  }

  export interface Sources extends Record<string, DataSource> {
    meta: Meta
    stats: Statistics
    profile: Profile
    registry: Registry
  }
}

export class WebServer {
  root: string
  adapter: WebAdapter
  global: WebServer.Global
  sources: WebServer.Sources

  constructor(private ctx: Context, public config: WebServer.Config) {
    this.root = resolve(__dirname, '..', config.devMode ? 'client' : 'dist')
    const { apiPath, uiPath, devMode, selfUrl, title } = config
    const endpoint = selfUrl + apiPath
    this.global = { title, uiPath, endpoint, devMode }
    this.sources = {
      profile: new Profile(ctx, config),
      meta: new Meta(ctx, config),
      registry: new Registry(ctx, config),
      stats: new Statistics(ctx, config),
    }
  }

  addClientEntry() {}

  async start() {
    const { uiPath } = this.config
    const [vite] = await Promise.all([this.createVite(), this.createAdapter()])

    this.ctx.router.get(uiPath + '(/.+)*', async (koa) => {
      // add trailing slash and redirect
      if (koa.path === uiPath && !uiPath.endsWith('/')) {
        return koa.redirect(koa.path + '/')
      }
      const filename = resolve(this.root, koa.path.slice(uiPath.length).replace(/^\/+/, ''))
      if (!filename.startsWith(this.root) && !filename.includes('node_modules')) {
        return koa.status = 403
      }
      const stats = await fs.stat(filename).catch<Stats>(noop)
      if (stats?.isFile()) {
        koa.type = extname(filename)
        return koa.body = createReadStream(filename)
      }
      let template = await fs.readFile(resolve(this.root, 'index.html'), 'utf8')
      if (vite) template = await vite.transformIndexHtml(uiPath, template)
      const scriptInjection = Object.entries(this.global).map(([key, value]) => {
        return `window.KOISHI_${snakeCase(key).toUpperCase()} = ${JSON.stringify(value)};`
      }).join('\n')
      koa.set('content-type', 'text/html')
      koa.body = template.replace('</head>', '<script>' + scriptInjection + '</script></head>')
    })
  }

  private async createAdapter() {
    this.adapter = new WebAdapter(this.ctx, this.config)

    this.adapter.server.on('connection', async (socket) => {
      for (const type in this.sources) {
        this.sources[type].get().then((body) => {
          socket.send(JSON.stringify({ type, body }))
        })
      }
    })

    this.ctx.before('disconnect', () => this.adapter.stop())

    await this.adapter.start()
  }

  private async createVite() {
    if (!this.config.devMode) return

    const { createServer } = require('vite') as typeof Vite
    const pluginVue = require('@vitejs/plugin-vue').default as typeof PluginVue

    const vite = await createServer({
      root: this.root,
      base: '/vite/',
      server: { middlewareMode: true },
      plugins: [pluginVue()],
      resolve: {
        alias: {
          '~/client': this.root,
          '~/variables': this.root + '/index.scss',
        },
      },
    })

    this.ctx.router.all('/vite(/.+)+', (koa) => new Promise((resolve) => {
      vite.middlewares(koa.req, koa.res, resolve)
    }))

    this.ctx.before('disconnect', () => vite.close())

    return vite
  }
}
