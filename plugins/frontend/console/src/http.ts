import { Context, Dict, noop, Random } from 'koishi'
import { resolve, extname } from 'path'
import { promises as fsp, Stats, createReadStream, existsSync } from 'fs'
import { DataService } from './service'
import { ViteDevServer } from 'vite'
import open from 'open'

class HttpService extends DataService<string[]> {
  private vite: ViteDevServer
  private data: Dict<string> = {}

  constructor(ctx: Context, private config: HttpService.Config) {
    super(ctx, 'http')

    const { devMode, uiPath } = config
    ctx.console.global.devMode = devMode
    ctx.console.global.uiPath = uiPath
    if (config.root === undefined) {
      config.root = resolve(__dirname, '..', devMode ? 'client' : 'dist')
    }
  }

  async start() {
    if (!this.config.root) return
    if (this.config.devMode) await this.createVite()
    this.serveAssets()

    if (this.config.open) {
      const { host, port } = this.ctx.app.options
      open(`http://${host || 'localhost'}:${port}${this.config.uiPath}`)
    }
  }

  addEntry(filename: string) {
    const key = 'extension-' + Random.id()
    this.data[key] = filename
    this.refresh()
    this.caller.on('dispose', () => {
      delete this.data[key]
      this.refresh()
    })
  }

  async get() {
    const { devMode, uiPath } = this.config
    if (devMode) {
      return Object.values(this.data).map(filename => '/vite/@fs/' + filename)
    }
    const filenames: string[] = []
    for (const name in this.data) {
      const baseDir = uiPath + '/' + name
      const localDir = this.data[name]
      filenames.push(baseDir + '/index.js')
      if (existsSync(localDir + '/style.css')) {
        filenames.push(baseDir + '/style.css')
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
    if (this.vite) template = await this.vite.transformIndexHtml(this.config.uiPath, template)
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
          strict: true,
        },
      },
      plugins: [vue()],
      resolve: {
        alias: {
          '~/client': root + '/client.ts',
          '~/components': '@koishijs/components',
        },
      },
      optimizeDeps: {
        exclude: [
          '@vueuse/core',
        ],
        include: [
          'ansi_up',
          'marked',
          'supports-color',
        ],
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
