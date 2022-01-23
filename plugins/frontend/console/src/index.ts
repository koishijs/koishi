import { App, Context, Logger, noop, version, Dict, WebSocketLayer, Schema, Awaitable, Service, sleep } from 'koishi'
import { resolve, extname } from 'path'
import { promises as fs, Stats, createReadStream } from 'fs'
import WebSocket from 'ws'
import open from 'open'
import { v4 } from 'uuid'
import type { ViteDevServer } from 'vite'

type SubServices = {
  [K in keyof Sources as `console.${K}`]: Sources[K]
}

declare module 'koishi' {
  namespace Context {
    interface Services extends SubServices {
      console: Console
    }
  }

  interface EventMap {
    'console/validate'(handle: SocketHandle): Awaitable<boolean>
  }

  interface Modules {
    console: typeof import('.')
  }
}

export abstract class DataSource<T = any> {
  protected start(): Awaitable<void> {}
  protected stop(): Awaitable<void> {}
  protected abstract get(forced?: boolean): Promise<T>

  constructor(protected ctx: Context, protected name: keyof Sources) {
    Context.service(`console.${name}`)
    ctx.console.services[name] = this as never

    sleep(0).then(() => {
      ctx.on('ready', () => this.start())
      ctx.on('dispose', () => this.stop())
    })
  }

  protected broadcast(type: string, value: any) {
    this.ctx.console.broadcast(type, { key: this.name, value })
  }

  async refresh() {
    this.broadcast('data', await this.get(true))
  }

  patch(value: T) {
    this.broadcast('patch', value)
  }
}

interface BaseConfig {
  devMode?: boolean
  uiPath?: string
}

export interface ClientConfig extends Required<BaseConfig> {
  version: string
  endpoint: string
  extensions: string[]
}

const logger = new Logger('console')

export class SocketHandle {
  readonly app: App
  readonly id: string

  constructor(console: Console, public socket: WebSocket) {
    this.app = console.ctx.app
    console.handles[this.id = v4()] = this
  }

  send(payload: any) {
    this.socket.send(JSON.stringify(payload), noop)
  }

  async validate() {
    return this.app.serial('console/validate', this)
  }
}

export type Listener = (this: SocketHandle, ...args: any[]) => Awaitable<any>

class Console extends Service {
  readonly global: ClientConfig
  readonly entries: Dict<string> = {}
  readonly handles: Dict<SocketHandle> = {}
  readonly platform = 'status'
  readonly listeners: Dict<Listener> = {}

  private vite: ViteDevServer
  private readonly server: WebSocketLayer

  constructor(public ctx: Context, public config: Console.Config) {
    super(ctx, 'console', true)

    const { apiPath, uiPath, devMode, selfUrl } = config
    const endpoint = selfUrl + apiPath
    this.global = { uiPath, endpoint, devMode, extensions: [], version }

    if (config.root === undefined) {
      config.root = resolve(__dirname, '..', devMode ? 'client' : 'dist')
    }

    this.server = ctx.router.ws(apiPath, this.onConnection)
  }

  broadcast(type: string, body: any) {
    if (!this?.server.clients.size) return
    const data = JSON.stringify({ type, body })
    this.server.clients.forEach((socket) => socket.send(data, noop))
  }

  private triggerReload() {
    this.global.extensions = Object.entries(this.entries).map(([name, filename]) => {
      return this.config.devMode ? '/vite/@fs/' + filename : `./${name}`
    })
    this.vite?.ws.send({ type: 'full-reload' })
  }

  addEntry(filename: string) {
    const hash = Math.floor(Math.random() * (16 ** 8)).toString(16).padStart(8, '0')
    const key = `entry-${hash}.js`
    this.entries[key] = filename
    this.triggerReload()
    this.caller.on('dispose', () => {
      delete this.entries[key]
      this.triggerReload()
    })
  }

  addListener<K extends keyof Events>(event: K, callback: Events[K]): void
  addListener(event: string, callback: Listener): void
  addListener(event: string, callback: Listener) {
    this.listeners[event] = callback
  }

  get services(): Sources {
    return new Proxy({}, {
      get: (target, name) => {
        if (typeof name === 'symbol') return Reflect.get(target, name)
        return Reflect.get(this.caller, 'console.' + name)
      },
      set: (target, name, value) => {
        if (typeof name === 'symbol') return Reflect.set(target, name, value)
        return Reflect.set(this.caller, 'console.' + name, value)
      },
    })
  }

  connect() {}

  async start() {
    if (!this.config.root) return
    if (this.config.devMode) await this.createVite()
    this.serveAssets()

    if (this.config.open) {
      const { host, port } = this.ctx.app.options
      open(`http://${host || 'localhost'}:${port}${this.config.uiPath}`)
    }
  }

  stop() {
    this.server.close()
  }

  private onConnection = (socket: WebSocket) => {
    const channel = new SocketHandle(this, socket)

    for (const name of Context.Services) {
      if (!name.startsWith('console.')) continue
      this.ctx[name]?.['get']().then((value) => {
        const key = name.slice(8)
        socket.send(JSON.stringify({ type: 'data', body: { key, value } }))
      })
    }

    socket.on('message', async (data) => {
      if (await channel.validate()) return
      const { type, args, id } = JSON.parse(data.toString())
      const listener = this.listeners[type]
      if (!listener) return logger.info('unknown message:', type, ...args)

      const value = await listener.call(channel, ...args)
      return channel.send({ type: 'response', body: { id, value } })
    })
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
      if (name.startsWith('assets/')) {
        const key = name.slice(7)
        if (this.entries[key]) return sendFile(this.entries[key])
      }
      const filename = resolve(root, name)
      if (!filename.startsWith(root) && !filename.includes('node_modules')) {
        return ctx.status = 403
      }
      const stats = await fs.stat(filename).catch<Stats>(noop)
      if (stats?.isFile()) return sendFile(filename)
      const ext = extname(filename)
      if (ext && ext !== '.html') return next()
      const template = await fs.readFile(resolve(root, 'index.html'), 'utf8')
      ctx.type = 'html'
      ctx.body = await this.transformHtml(template)
    })
  }

  private async transformHtml(template: string) {
    if (this.vite) template = await this.vite.transformIndexHtml(this.config.uiPath, template)
    const headInjection = `<script>KOISHI_CONFIG = ${JSON.stringify(this.global)}</script>`
    return template.replace('</title>', '</title>' + headInjection)
  }

  private async createVite() {
    const { root } = this.config
    const { createServer } = require('vite') as typeof import('vite')
    const { default: pluginVue } = require('@vitejs/plugin-vue') as typeof import('@vitejs/plugin-vue')

    this.vite = await createServer({
      root: root,
      base: '/vite/',
      server: {
        middlewareMode: true,
        fs: {
          strict: true,
        },
      },
      plugins: [pluginVue()],
      resolve: {
        alias: {
          '~/client': root + '/client.ts',
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

export interface Sources {}

export interface Events {}

namespace Console {
  export interface Config extends BaseConfig {
    root?: string
    open?: boolean
    selfUrl?: string
    apiPath?: string
  }

  export const Config = Schema.object({
    uiPath: Schema.string().description('前端页面呈现的路径。').default(''),
    apiPath: Schema.string().description('后端 API 服务的路径。').default('/status'),
    selfUrl: Schema.string().description('Koishi 服务暴露在公网的地址。').comment('与其他需要 selfUrl 配置项的地方不同的是，这里的属性不会继承 app.options.selfUrl 的值。这是因为，由于这里缺省时会使用相对路径，网页依旧可以正常访问。只有你将 uiPath 和 apiPath 分别部署到了不同的端口或域名时，这个选项才建议使用。').default(''),
    open: Schema.boolean().description('在应用启动后自动在浏览器中打开控制台。'),
    devMode: Schema.boolean().description('启用调试模式（仅供开发者使用）。'),
  })
}

export default Console
