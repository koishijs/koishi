import { Adapter, App, Context, Logger, noop, omit, pick, Random, remove, Time, User, version } from 'koishi'
import { resolve, extname } from 'path'
import { promises as fs, Stats, createReadStream } from 'fs'
import Awesome from './payload/awesome'
import Registry from './payload/registry'
import Meta from './payload/meta'
import Profile from './payload/profile'
import Statistics from './payload/stats'
import WebSocket from 'ws'
import type * as Vite from 'vite'
import type PluginVue from '@vitejs/plugin-vue'

export { Awesome, Registry, Meta, Profile, Statistics }

interface BaseConfig {
  title?: string
  devMode?: boolean
  uiPath?: string
}

export interface Config extends BaseConfig, Profile.Config, Meta.Config, Registry.Config, Statistics.Config {
  title?: string
  selfUrl?: string
  apiPath?: string
  expiration?: number
}

export interface ClientConfig extends Required<BaseConfig> {
  version: string
  database: boolean
  endpoint: string
  extensions: string[]
}

const logger = new Logger('webui')
const TOKEN_TIMEOUT = Time.minute * 10

export class SocketHandle {
  readonly app: App
  readonly id = Random.uuid()
  authority: number

  constructor(public readonly webui: WebServer, public socket: WebSocket) {
    this.app = webui.app
  }

  send(type: string, body?: any) {
    this.socket.send(JSON.stringify({ type, body }))
  }

  async validate<T extends User.Field>(id: string, token: string, fields: T[] = []) {
    const user = await this.app.database.getUser('id', id, ['token', 'expire', 'authority', ...fields])
    if (!user || token !== user.token || user.expire <= Date.now()) {
      return this.send('expire')
    }
    this.authority = user.authority
    return user
  }
}

export class WebServer extends Adapter {
  readonly root: string
  readonly sources: WebServer.Sources
  readonly global: ClientConfig
  readonly entries: Record<string, string> = {}
  readonly handles: Record<string, SocketHandle> = {}
  readonly states: Record<string, [string, number, SocketHandle]> = {}

  private vite: Vite.ViteDevServer
  private readonly server: WebSocket.Server
  private readonly [Context.current]: Context

  constructor(private ctx: Context, public config: Config) {
    super(ctx.app)

    const { apiPath, uiPath, devMode, selfUrl, title } = config
    const endpoint = selfUrl + apiPath
    this.global = { title, uiPath, endpoint, devMode, extensions: [], database: false, version }
    this.root = resolve(__dirname, '..', devMode ? 'client' : 'dist')

    this.server = new WebSocket.Server({
      path: apiPath,
      server: ctx.app._httpServer,
    })

    this.sources = {
      awesome: new Awesome(ctx, config),
      profile: new Profile(ctx, config),
      meta: new Meta(ctx, config),
      registry: new Registry(ctx, config),
      stats: new Statistics(ctx, config),
    }

    ctx.all().middleware(async (session, next) => {
      if (session.subtype !== 'private') return next()
      const state = this.states[session.uid]
      if (state && state[0] === session.content) {
        const user = await session.observeUser(['id', 'name', 'authority', 'token', 'expire'])
        user.token = Random.uuid()
        user.expire = Date.now() + config.expiration
        return state[2].send('user', user)
      }
      return next()
    }, true)

    ctx.on('connect', () => this.start())
    ctx.before('disconnect', () => this.stop())

    ctx.on('delegate/database', () => {
      this.global.database = !!ctx.database
    })
  }

  broadcast(type: string, body: any) {
    if (!this?.server.clients.size) return
    const data = JSON.stringify({ type, body })
    this.server.clients.forEach((socket) => socket.send(data))
  }

  private triggerReload() {
    this.global.extensions = Object.entries(this.entries).map(([name, filename]) => {
      return this.config.devMode ? '/vite/@fs' + filename : `./${name}`
    })
    this.vite?.ws.send({ type: 'full-reload' })
  }

  addEntry(filename: string) {
    const ctx = this[Context.current]
    let { state } = ctx
    state[Registry.webExtension] = true
    while (state && !state.name) state = state.parent
    const hash = Math.floor(Math.random() * (16 ** 8)).toString(16).padStart(8, '0')
    const key = `${state?.name || 'entry'}-${hash}.js`
    this.entries[key] = filename
    this.triggerReload()
    ctx.before('disconnect', () => {
      delete this.entries[key]
      this.triggerReload()
    })
  }

  addListener(event: string, listener: WebServer.Listener) {
    WebServer.listeners[event] = listener
  }

  async start() {
    if (this.config.devMode) await this.createVite()
    this.server.on('connection', this.onConnection)
    this.serveAssets()
  }

  stop() {
    this.server.close()
    for (const bot of this.bots) {
      remove(this.app.bots, bot)
    }
  }

  private onConnection = (socket: WebSocket) => {
    const channel = new SocketHandle(this, socket)
    this.handles[channel.id] = channel

    for (const type in this.sources) {
      this.sources[type].get().then((body) => {
        socket.send(JSON.stringify({ type, body }))
      })
    }

    socket.on('close', () => {
      delete this.handles[channel.id]
      for (const id in this.states) {
        if (this.states[id][2] === channel) delete this.states[id]
      }
    })

    socket.on('message', async (data) => {
      if (!this.ctx.database) return
      const { type, body } = JSON.parse(data.toString())
      const method = WebServer.listeners[type]
      if (method) {
        await method.call(channel, body)
      } else {
        logger.info(type, body)
      }
    })
  }

  private serveAssets() {
    const { uiPath } = this.config

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
    if (this.vite) template = await this.vite.transformIndexHtml(this.config.uiPath, template)
    const headInjection = `<script>KOISHI_CONFIG = ${JSON.stringify(this.global)}</script>`
    return template.replace('</title>', '</title>' + headInjection)
  }

  private async createVite() {
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

export namespace WebServer {
  export interface DataSource<T = any> {
    get(forced?: boolean): Promise<T>
  }

  export interface Sources extends Record<string, DataSource> {
    meta: Meta
    awesome: Awesome
    stats: Statistics
    profile: Profile
    registry: Registry
  }

  export type Listener = (this: SocketHandle, payload: any) => Promise<void>
  export const listeners: Record<string, Listener> = {}

  // builtin listeners

  listeners.validate = async function ({ id, token }) {
    await this.validate(id, token)
  }

  listeners.token = async function ({ platform, userId }) {
    const user = await this.app.database.getUser(platform, userId, ['name'])
    if (!user) return this.send('login', { message: '找不到此账户。' })
    const id = `${platform}:${userId}`
    const token = Random.uuid()
    const expire = Date.now() + TOKEN_TIMEOUT
    const { states } = this.app.webui
    states[id] = [token, expire, this]
    setTimeout(() => {
      if (states[id]?.[1] > Date.now()) delete states[id]
    }, TOKEN_TIMEOUT)
    this.send('login', { token, name: user.name })
  }

  listeners.password = async function ({ id, token, password }) {
    const user = await this.validate(id, token, ['password'])
    if (!user || password === user.password) return
    await this.app.database.setUser('id', id, { password })
  }

  listeners.login = async function ({ username, password }) {
    const user = await this.app.database.getUser('name', username, ['password', 'authority', 'id', 'expire', 'token'])
    if (!user || user.password !== password) {
      return this.send('login', { message: '用户名或密码错误。' })
    }
    user.token = Random.uuid()
    user.expire = Date.now() + this.app.webui.config.expiration
    await this.app.database.setUser('name', username, pick(user, ['token', 'expire']))
    this.send('user', omit(user, ['password']))
    this.authority = user.authority
  }

  listeners.install = async function ({ id, token, name }) {
    const user = await this.validate(id, token, ['name', 'authority'])
    if (!user) return
    if (user.authority < 4) return this.send('unauthorized')
    this.webui.sources.awesome.install(name)
  }

  listeners.switch = async function ({ id, token, plugin }) {
    const user = await this.validate(id, token, ['name', 'authority'])
    if (!user) return
    if (user.authority < 4) return this.send('unauthorized')
    this.webui.sources.registry.switch(plugin)
  }
}
