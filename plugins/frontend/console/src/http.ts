import { Context, Dict, noop, Random } from 'koishi'
import { dirname, extname, resolve } from 'path'
import { createReadStream, existsSync, promises as fsp, Stats } from 'fs'
import { DataService } from './service'
import { ViteDevServer } from 'vite'
import open from 'open'

export interface Entry {
  dev: string
  prod: string
}

class HttpService extends DataService<string[]> {
  private vite: ViteDevServer
  private data: Dict<string> = {}

  constructor(ctx: Context, private config: HttpService.Config) {
    super(ctx, 'http')

    config.root ||= config.devMode
      ? resolve(dirname(require.resolve('@koishijs/client/package.json')), 'app')
      : resolve(__dirname, '../dist')
  }

  async start() {
    if (!this.config.root) return
    if (this.config.devMode) await this.createVite()
    this.serveAssets()

    if (this.config.open && !process.env.KOISHI_AGENT) {
      const { host, port } = this.ctx.app.options
      open(`http://${host || 'localhost'}:${port}${this.config.uiPath}`)
    }
  }

  private resolveEntry(entry: string | Entry) {
    if (typeof entry === 'string') return entry
    if (!this.config.devMode) return entry.prod
    if (!existsSync(entry.dev)) return entry.prod
    return entry.dev
  }

  addEntry(entry: string | Entry) {
    const key = 'extension-' + Random.id()
    this.data[key] = this.resolveEntry(entry)
    this.refresh()
    this.caller?.on('dispose', () => {
      delete this.data[key]
      this.refresh()
    })
  }

  async get() {
    const { devMode, uiPath } = this.config
    const filenames: string[] = []
    for (const key in this.data) {
      const local = this.data[key]
      const filename = devMode ? '/vite/@fs/' + local : uiPath + '/' + key
      if (extname(local)) {
        filenames.push(filename)
      } else {
        filenames.push(filename + '/index.js')
        if (existsSync(local + '/style.css')) {
          filenames.push(filename + '/style.css')
        }
      }
    }
    return filenames
  }

  private serveAssets() {
    const { uiPath, root } = this.config

    this.ctx.router.get(uiPath + '(/.+)*', async (ctx, next) => {
      // add trailing slash and redirect
      if (ctx.path === uiPath && !uiPath.endsWith('/')) {
        return ctx.redirect(ctx.path + '/')
      }
      const name = ctx.path.slice(uiPath.length).replace(/^\/+/, '')
      const sendFile = (filename: string) => {
        ctx.type = extname(filename)
        return ctx.body = createReadStream(filename)
      }
      if (name.startsWith('extension-')) {
        const key = name.slice(0, 18)
        if (this.data[key]) return sendFile(this.data[key] + name.slice(18))
      }
      const filename = resolve(root, name)
      if (!filename.startsWith(root) && !filename.includes('node_modules')) {
        return ctx.status = 403
      }
      const stats = await fsp.stat(filename).catch<Stats>(noop)
      if (stats?.isFile()) return sendFile(filename)
      const ext = extname(filename)
      if (ext && ext !== '.html') return next()
      const template = await fsp.readFile(resolve(root, 'index.html'), 'utf8')
      ctx.type = 'html'
      ctx.body = await this.transformHtml(template)
    })
  }

  private async transformHtml(template: string) {
    const { uiPath } = this.config
    if (this.vite) {
      template = await this.vite.transformIndexHtml(uiPath, template)
    } else {
      template = template.replace(/(href|src)="(?=\/)/g, (_, $1) => `${$1}="${uiPath}`)
    }
    const headInjection = `<script>KOISHI_CONFIG = ${JSON.stringify(this.ctx.console.global)}</script>`
    return template.replace('</title>', '</title>' + headInjection)
  }

  private async createVite() {
    const { root } = this.config
    const { createServer } = require('vite') as typeof import('vite')
    const { default: vue } = require('@vitejs/plugin-vue') as typeof import('@vitejs/plugin-vue')

    this.vite = await createServer({
      root,
      base: '/vite/',
      server: {
        middlewareMode: true,
        fs: {
          strict: false,
        },
      },
      plugins: [vue()],
      resolve: {
        dedupe: ['vue'],
        alias: {
          '../client.js': '@koishijs/client',
          '../vue.js': 'vue',
          '../vue-router.js': 'vue-router',
          '../vueuse.js': '@vueuse/core',
        },
      },
      optimizeDeps: {
        include: [
          'schemastery',
          'element-plus',
        ],
      },
      build: {
        rollupOptions: {
          input: this.config.root + '/index.html',
        },
      },
    })

    this.ctx.router.all('/vite(/.+)*', (ctx) => new Promise((resolve) => {
      this.vite.middlewares(ctx.req, ctx.res, resolve)
    }))

    this.ctx.on('dispose', () => this.vite.close())
  }
}

namespace HttpService {
  export interface Config {
    root?: string
    uiPath?: string
    devMode?: boolean
    open?: boolean
  }
}

export default HttpService
