import ms from 'ms'
import WebSocket from 'ws'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { Server as _Server } from 'http'
import { emitter, errors } from './shared'
import { createHmac } from 'crypto'
import { camelCase, snakeCase, paramCase, CQCode } from 'koishi-utils'
import { Meta, VersionInfo, ContextType } from './meta'
import { App } from './app'
import { CQResponse } from './sender'
import { format } from 'util'

export abstract class Server {
  public appList: App[] = []
  public version: VersionInfo
  public appMap: Record<number, App> = {}
  public isListening = false

  public koa?: Koa
  public server?: _Server
  public socket?: WebSocket

  protected abstract _listen (): Promise<void>
  protected abstract _close (): void

  constructor (app: App) {
    this.bind(app)
  }

  /**
   * representative app
   */
  get app () {
    return this.appList[0]
  }

  protected debug (format: any, ...params: any[]) {
    this.app?.logger('koishi:server').debug(format, ...params)
  }

  protected prepareMeta (data: any) {
    const meta = camelCase<Meta>(data)
    if (!meta.selfId) {
      // below version 3.4
      meta.selfId = this.app.selfId
    } else if (!this.appMap[meta.selfId]) {
      const app = this.appList.find(app => !app.options.selfId)
      if (!app) return
      app.prepare(meta.selfId)
    }
    return new Meta(meta)
  }

  parseMeta (meta: Meta) {
    // prepare prefix
    let ctxType: ContextType, ctxId: number
    if (meta.groupId) {
      ctxType = 'group'
      ctxId = meta.groupId
    } else if (meta.discussId) {
      ctxType = 'discuss'
      ctxId = meta.discussId
    } else if (meta.userId) {
      ctxType = 'user'
      ctxId = meta.userId
    }

    // polyfill array format of post message
    if (Array.isArray(meta.message)) {
      meta.message = CQCode.stringifyAll(meta.message)
    }

    // prepare events
    const events: string[] = []
    if (meta.postType === 'message' || meta.postType === 'send') {
      events.push(meta.postType)
    } else if (meta.postType === 'request') {
      events.push('request/' + meta.requestType)
    } else if (meta.postType === 'notice') {
      events.push(meta.noticeType)
    } else {
      events.push(meta.metaEventType)
    }
    if (meta.subType) events.unshift(events[0] + '/' + meta.subType)

    // generate path
    meta.$ctxId = ctxId
    meta.$ctxType = ctxType
    meta.$app = this.appMap[meta.selfId]

    return events
  }

  dispatchMeta (meta: Meta) {
    const app = this.appMap[meta.selfId]
    const events = this.parseMeta(meta)
    for (const event of events) {
      app.emit(meta, paramCase(event) as any, meta)
    }
  }

  bind (app: App) {
    this.appList.push(app)
    if (app.options.selfId) {
      this.appMap[app.options.selfId] = app
    }
    return this
  }

  versionLessThan (major: number, minor: number = 0, patch: number = 0) {
    const { pluginMajorVersion, pluginMinorVersion, pluginPatchVersion } = this.version
    return pluginMajorVersion < major || pluginMajorVersion === major &&
      (pluginMinorVersion < minor || pluginMinorVersion === minor && pluginPatchVersion < patch)
  }

  async listen () {
    if (this.isListening) return
    this.isListening = true
    try {
      await this._listen()
      if (this.versionLessThan(4)) {
        throw new Error(errors.UNSUPPORTED_CQHTTP_VERSION)
      }
    } catch (error) {
      this.close()
      throw error
    }
  }

  close () {
    this.version = undefined
    this.isListening = false
    this._close()
  }
}

export class HttpServer extends Server {
  constructor (app: App) {
    super(app)

    const { secret, path = '/' } = app.options
    this.koa = new Koa()
    this.koa.use(bodyParser())
    this.koa.use((ctx, next) => {
      if (ctx.url !== path) return next()
      if (secret) {
        // no signature
        const signature = ctx.headers['x-signature']
        if (!signature) return ctx.status = 401

        // invalid signature
        const sig = createHmac('sha1', secret).update(ctx.request.rawBody).digest('hex')
        if (signature !== `sha1=${sig}`) return ctx.status = 403
      }

      // no matched application
      this.debug('receive %o', ctx.request.body)
      const meta = this.prepareMeta(ctx.request.body)
      if (!meta) return ctx.status = 403

      const { quickOperationTimeout } = this.appMap[meta.selfId].options
      if (quickOperationTimeout > 0) {
        // bypass koa's built-in response handling for quick operations
        ctx.respond = false
        ctx.res.writeHead(200, {
          'Content-Type': 'application/json',
        })
        meta.$response = (data) => {
          clearTimeout(timer)
          ctx.res.write(JSON.stringify(snakeCase(data)))
          ctx.res.end()
          meta.$response = null
        }
        const timer = setTimeout(() => {
          ctx.res.end()
          meta.$response = null
        }, quickOperationTimeout)
      }

      // dispatch events
      this.dispatchMeta(meta)
    })
  }

  async _listen () {
    this.debug('http server opening')
    const { port } = this.app.options
    this.server = this.koa.listen(port)
    try {
      this.version = await this.app.sender.getVersionInfo()
    } catch (error) {
      throw new Error('authorization failed')
    }
    this.debug('http server listen to', port)
  }

  _close () {
    this.server.close()
    this.debug('http server closed')
  }
}

let counter = 0

export class WsClient extends Server {
  private _retryCount = 0
  private _listeners: Record<number, (response: CQResponse) => void> = {}

  send (data: any): Promise<CQResponse> {
    data.echo = ++counter
    return new Promise((resolve, reject) => {
      this._listeners[counter] = resolve
      this.socket.send(JSON.stringify(data), (error) => {
        if (error) reject(error)
      })
    })
  }

  _listen (): Promise<void> {
    const connect = (resolve: () => void, reject: (reason: Error) => void) => {
      this.debug('websocket client opening')
      const headers: Record<string, string> = {}
      const { token, server, retryInterval, retryTimes } = this.app.options
      if (token) headers.Authorization = `Bearer ${token}`
      this.socket = new WebSocket(server, { headers })

      this.socket.on('error', error => this.debug(error))

      this.socket.once('close', (code) => {
        if (!this.isListening || code === 1005) return

        const message = `failed to connect to ${server}`
        if (!retryInterval || this._retryCount >= retryTimes) {
          return reject(new Error(message))
        }

        this._retryCount++
        this.debug(`${message}, will retry in ${ms(retryInterval)}...`)
        setTimeout(() => {
          if (this.isListening) connect(resolve, reject)
        }, retryInterval)
      })

      this.socket.once('open', () => {
        this._retryCount = 0

        this.socket.send(JSON.stringify({
          action: 'get_version_info',
          echo: -1,
        }), (error) => {
          if (error) reject(error)
        })

        this.socket.on('message', (data) => {
          data = data.toString()
          this.debug('receive', data)
          let parsed: any
          try {
            parsed = JSON.parse(data)
          } catch (error) {
            return reject(new Error(data))
          }

          if ('post_type' in parsed) {
            const meta = this.prepareMeta(parsed)
            if (meta) this.dispatchMeta(meta)
          } else if (parsed.echo === -1) {
            this.version = camelCase(parsed.data)
            this.debug('connect to ws server:', this.app.options.server)
            emitter.emit('ws-client', this.socket)
            resolve()
          } else {
            this._listeners[parsed.echo]?.(parsed)
          }
        })
      })
    }
    return new Promise(connect)
  }

  _close () {
    this.socket.close()
    this._retryCount = 0
    this.debug('websocket client closed')
  }
}

export type ServerType = 'http' | 'ws' // 'ws-reverse'

export const serverMap: Record<ServerType, Record<keyof any, Server>> = { http: {}, ws: {} }

export function createServer (app: App) {
  if (typeof app.options.type !== 'string') {
    throw new Error(errors.UNSUPPORTED_SERVER_TYPE)
  }
  app.options.type = app.options.type.toLowerCase() as any
  let key: keyof any, Server: new (app: App) => Server
  if (app.options.type === 'http') {
    key = 'port'
    Server = HttpServer
  } else if (app.options.type === 'ws') {
    key = 'server'
    Server = WsClient
  } else {
    throw new Error(errors.UNSUPPORTED_SERVER_TYPE)
  }
  const servers = serverMap[app.options.type]
  const value = app.options[key]
  if (!value) {
    throw new Error(format(errors.MISSING_CONFIGURATION, key))
  }
  if (value in servers) {
    return servers[value].bind(app)
  }
  return servers[value] = new Server(app)
}
