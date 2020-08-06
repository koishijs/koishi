import ms from 'ms'
import axios from 'axios'
import type WebSocket from 'ws'
import type Koa from 'koa'
import type Router from 'koa-router'
import {} from 'koa-bodyparser'
import { Server } from 'http'
import { createHmac } from 'crypto'
import { camelCase, snakeCase, paramCase, Logger, defineProperty } from 'koishi-utils'
import { Session } from './session'
import { App } from './app'
import { CQSender, CQResponse } from './sender'

const logger = Logger.create('server')

export interface BotOptions {
  token?: string
  server?: string
  selfId?: number
}

export abstract class CQServer {
  public bots: CQSender[]
  public koa?: Koa
  public router?: Router
  public server?: Server
  public wsServer?: WebSocket.Server

  protected _isListening = false
  protected _isReady = false

  protected abstract _listen (): Promise<void>
  protected abstract _close (): void

  constructor (public app: App) {
    app.on('before-connect', this.listen.bind(this))
    app.on('before-disconnect', this.close.bind(this))
    const senders = app.options.bots.map(bot => new CQSender(app, bot))
    this.bots = new Proxy(senders, {
      get (target, prop) {
        return typeof prop === 'symbol' || +prop * 0 !== 0
          ? Reflect.get(target, prop)
          : target[prop] || target.find(bot => bot.selfId === +prop)
      },
      set (target, prop, value) {
        return typeof prop === 'symbol' || +prop * 0 !== 0
          ? Reflect.set(target, prop, value)
          : false
      },
    })
  }

  prepare (data: any) {
    const meta = camelCase<Session>(data)
    if (!this.bots[meta.selfId]) {
      const bot = this.bots.find(bot => !bot.selfId)
      if (!bot) return
      bot.selfId = meta.selfId
      this.ready()
    }
    meta.$app = this.app
    return new Session(meta)
  }

  dispatch (session: Session) {
    const events: string[] = []
    if (session.postType === 'message' || session.postType === 'send') {
      events.push(session.postType)
    } else if (session.postType === 'request') {
      events.push('request/' + session.requestType)
    } else if (session.postType === 'notice') {
      events.push(session.noticeType)
    } else {
      events.push(session.metaEventType)
    }
    if (session.subType) {
      events.unshift(events[0] + '/' + session.subType)
    }
    for (const event of events) {
      this.app.emit(session, paramCase<any>(event), session)
    }
  }

  async listen () {
    if (this._isListening) return
    this._isListening = true
    try {
      await this._listen()
    } catch (error) {
      this.close()
      throw error
    }
  }

  close () {
    this._isListening = false
    this._close()
  }

  ready () {
    if (this._isReady || !this.bots.every(bot => bot.selfId || !bot._get)) return
    this._isReady = true
    this.app.emit('ready')
  }
}

class HttpServer extends CQServer {
  constructor (app: App) {
    super(app)
    const { port } = app.options
    if (!port) throw new Error('missing configuration "port"')

    this.koa = new (require('koa'))()
    this.router = new (require('koa-router'))()
    this.koa.use(require('koa-bodyparser')())
    this.koa.use(this.router.routes())
    this.koa.use(this.router.allowedMethods())
  }

  private async __listen (bot: CQSender) {
    if (!bot.server) return
    bot._get = async (action, params) => {
      const headers = { 'Content-Type': 'application/json' } as any
      if (bot.token) {
        headers.Authorization = `Token ${bot.token}`
      }
      const uri = new URL(action, bot.server).href
      const { data } = await axios.post(uri, params, { headers })
      return data
    }
    bot.version = await bot.getVersionInfo()
    logger.debug('%d got version info', bot.selfId)
  }

  async _listen () {
    const { secret, path = '/' } = this.app.options
    this.router.post(path, (ctx) => {
      if (secret) {
        // no signature
        const signature = ctx.headers['x-signature']
        if (!signature) return ctx.status = 401

        // invalid signature
        const sig = createHmac('sha1', secret).update(ctx.request.rawBody).digest('hex')
        if (signature !== `sha1=${sig}`) return ctx.status = 403
      }

      logger.debug('receive %o', ctx.request.body)
      const meta = this.prepare(ctx.request.body)
      if (!meta) return ctx.status = 403

      const { quickOperationTimeout } = this.app.options
      if (quickOperationTimeout > 0) {
        // bypass koa's built-in response handling for quick operations
        ctx.respond = false
        ctx.res.writeHead(200, {
          'Content-Type': 'application/json',
        })

        // use defineProperty to avoid meta duplication
        defineProperty(meta, '$response', (data) => {
          meta.$response = null
          clearTimeout(timer)
          ctx.res.write(JSON.stringify(snakeCase(data)))
          ctx.res.end()
        })

        const timer = setTimeout(() => {
          meta.$response = null
          ctx.res.end()
        }, quickOperationTimeout)
      }

      // dispatch events
      this.dispatch(meta)
    })

    const { port } = this.app.options
    logger.debug('http server opening at', port)
    this.server = this.koa.listen(port)
    await Promise.all(this.bots.map(bot => this.__listen(bot)))
  }

  _close () {
    logger.debug('http server closing')
    this.server.close()
  }
}

let counter = 0

class WsChannel {
  private _listeners: Record<number, (response: CQResponse) => void> = {}

  constructor (private server: CQServer) {}

  connect = (resolve: () => void, reject: (error: Error) => void, bot: CQSender) => {
    bot.socket.on('message', (data) => {
      data = data.toString()
      let parsed: any
      try {
        parsed = JSON.parse(data)
      } catch (error) {
        return logger.warn('cannot parse message', data)
      }

      if ('post_type' in parsed) {
        logger.debug('receive %o', parsed)
        const meta = this.server.prepare(parsed)
        if (meta) this.server.dispatch(meta)
      } else if (parsed.echo === -1) {
        logger.debug('%d got version info', bot.selfId)
        bot.version = camelCase(parsed.data)
        resolve()
      } else {
        this._listeners[parsed.echo]?.(parsed)
      }
    })

    bot.socket.send(JSON.stringify({
      action: 'get_version_info',
      echo: -1,
    }), (error) => {
      if (error) reject(error)
    })

    bot._get = (action, params) => {
      const data = { action, params, echo: ++counter }
      data.echo = ++counter
      return new Promise((resolve, reject) => {
        this._listeners[counter] = resolve
        bot.socket.send(JSON.stringify(data), (error) => {
          if (error) reject(error)
        })
      })
    }
  }
}

class WsClient extends CQServer {
  private _retryCount = 0
  private _channel = new WsChannel(this)
  private _sockets = new Set<WebSocket>()

  private async __listen (bot: CQSender) {
    const { token, server } = bot
    if (!server) return
    const Socket: typeof WebSocket = require('ws')
    const connect = (resolve: () => void, reject: (reason: Error) => void) => {
      logger.debug('websocket client opening')
      const headers: Record<string, string> = {}
      const { retryInterval, retryTimes } = this.app.options
      if (token) headers.Authorization = `Bearer ${token}`
      const socket = new Socket(server, { headers })
      this._sockets.add(socket)

      socket.on('error', error => logger.debug(error))

      socket.on('close', (code) => {
        this._sockets.delete(socket)
        if (!this._isListening || code === 1005) return

        const message = `failed to connect to ${server}`
        if (!retryInterval || this._retryCount >= retryTimes) {
          return reject(new Error(message))
        }

        this._retryCount++
        logger.warn(`${message}, will retry in ${ms(retryInterval)}...`)
        setTimeout(() => {
          if (this._isListening) connect(resolve, reject)
        }, retryInterval)
      })

      socket.on('open', () => {
        this._retryCount = 0
        logger.debug('connect to ws server:', bot.server)
        bot.socket = socket
        this._channel.connect(resolve, reject, bot)
      })
    }
    return new Promise(connect)
  }

  async _listen () {
    await Promise.all(this.bots.map(bot => this.__listen(bot)))
  }

  _close () {
    logger.debug('websocket client closing')
    for (const socket of this._sockets) {
      socket.close()
    }
    this._retryCount = 0
  }
}

class WsServer extends HttpServer {
  private _channel = new WsChannel(this)

  _listen () {
    const { port, path = '/' } = this.app.options
    const ws: typeof WebSocket = require('ws')
    logger.debug('ws server opening at', port)
    this.server = this.koa.listen(port)
    this.wsServer = new ws.Server({
      path,
      server: this.server,
    })

    return new Promise<void>((resolve, reject) => {
      this.wsServer.on('error', reject)
      this.wsServer.on('connection', (socket, { headers }) => {
        logger.debug('connected with', headers)
        if (headers['x-client-role'] !== 'Universal') {
          return socket.close(1008, 'invalid x-client-role')
        }
        let bot: CQSender
        const selfId = +headers['x-self-id']
        if (!selfId || !(bot = this.bots[selfId] || this.bots.find(bot => !bot.selfId))) {
          return socket.close(1008, 'invalid x-self-id')
        }
        if (!bot.selfId) bot.selfId = selfId

        socket.on('close', () => {
          delete bot.socket
          delete bot._get
        })

        bot.socket = socket
        this._channel.connect(() => {
          if (this.bots.every(({ version, server }) => version || server === null)) resolve()
        }, reject, bot)
      })
    })
  }

  _close () {
    logger.debug('ws server closing')
    this.wsServer.close()
    super._close()
  }
}

/* eslint-disable quote-props */

export interface ServerTypes {
  'http': typeof HttpServer
  'ws': typeof WsClient
  'ws-reverse': typeof WsServer
}

export namespace CQServer {
  export const types: ServerTypes = {
    'http': HttpServer,
    'ws': WsClient,
    'ws-reverse': WsServer,
  }
}
