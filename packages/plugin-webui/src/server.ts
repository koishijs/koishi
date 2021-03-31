import { Context, noop, snakeCase } from 'koishi-core'
import { resolve, extname } from 'path'
import { promises as fs, Stats, createReadStream } from 'fs'
import { WebAdapter } from './adapter'
import { DataSource, Profile, Meta, Registry } from './data'
import { Statistics } from './stats'
import type * as Vite from 'vite'
import type PluginVue from '@vitejs/plugin-vue'

Context.delegate('webui')

export interface Config extends WebAdapter.Config, Profile.Config, Meta.Config, Registry.Config, Statistics.Config {
  title?: string
  selfUrl?: string
  uiPath?: string
  devMode?: boolean
}

export namespace WebServer {
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
  entries: Record<string, string> = {}

  private vite: Vite.ViteDevServer
  private readonly [Context.current]: Context

  constructor(private ctx: Context, public config: Config) {
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

    ctx.on('connect', () => this.start())
  }

  addEntry(filename: string) {
    const ctx = this[Context.current]
    let { state } = ctx
    while (state && !state.name) state = state.parent
    const hash = Math.floor(Math.random() * (16 ** 8)).toString(16).padStart(8, '0')
    const key = `${state?.name || 'entry'}-${hash}.js`
    this.entries[key] = filename
    this.vite?.ws.send({ type: 'full-reload' })
    ctx.before('disconnect', () => {
      delete this.entries[key]
      this.vite?.ws.send({ type: 'full-reload' })
    })
  }

  private async start() {
    const { uiPath } = this.config
    await Promise.all([this.createVite(), this.createAdapter()])

    this.ctx.router.get(uiPath + '(/.+)*', async (ctx) => {
      // add trailing slash and redirect
      if (ctx.path === uiPath && !uiPath.endsWith('/')) {
        return ctx.redirect(ctx.path + '/')
      }
      const name = ctx.path.slice(uiPath.length).replace(/^\/+/, '')
      const sendFile = (filename: string) => {
        ctx.type = extname(filename)
        return ctx.body = createReadStream(filename)
      }
      if (name.startsWith('assets/')) {
        const key = name.slice(7)
        if (this.entries[key]) return sendFile(this.entries[key])
      }
      const filename = resolve(this.root, name)
      if (!filename.startsWith(this.root) && !filename.includes('node_modules')) {
        return ctx.status = 403
      }
      const stats = await fs.stat(filename).catch<Stats>(noop)
      if (stats?.isFile()) return sendFile(filename)
      const ext = extname(filename)
      if (ext && ext !== '.html') return ctx.status = 404
      const template = await fs.readFile(resolve(this.root, 'index.html'), 'utf8')
      ctx.type = 'html'
      ctx.body = await this.transformHtml(template)
    })
  }

  private async transformHtml(template: string) {
    if (this.vite) {
      template = await this.vite.transformIndexHtml(this.config.uiPath, template)
    }
    const headInjection = '<script>' + Object.entries(this.global).map(([key, value]) => {
      return `window.KOISHI_${snakeCase(key).toUpperCase()} = ${JSON.stringify(value)};`
    }).join('\n') + '</script>'
    const bodyInjection = Object.entries(this.entries).map(([name, filename]) => {
      const src = this.config.devMode ? '/vite/@fs' + filename : `./assets/${name}`
      return `<script type="module" src="${src}"></script>`
    }).join('\n')
    return template
      .replace('</title>', '</title>' + headInjection)
      .replace('</body>', bodyInjection + '</body>')
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

    this.vite = await createServer({
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

    this.ctx.router.all('/vite(/.+)+', (ctx) => new Promise((resolve) => {
      this.vite.middlewares(ctx.req, ctx.res, resolve)
    }))

    this.ctx.before('disconnect', () => this.vite.close())
  }
}
