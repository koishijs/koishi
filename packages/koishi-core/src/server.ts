import ms from 'ms'
import axios from 'axios'
import type WebSocket from 'ws'
import type Koa from 'koa'
import type Router from 'koa-router'
import {} from 'koa-bodyparser'
import { Server } from 'http'
import { createHmac } from 'crypto'
import { camelCase, snakeCase, paramCase, Logger, defineProperty } from 'koishi-utils'
import { Meta, ContextType } from './meta'
import { App } from './app'
import { CQSender, CQResponse } from './sender'

const logger = Logger.create('server')

export interface BotOptions {
  token?: string
  server?: string
  selfId?: number
}

export interface Bot extends BotOptions {
  sender?: CQSender
}

function createBotsProxy (bots: Bot[]) {
  return new Proxy(bots, {
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

export abstract class CQServer {
  public bots: Bot[]
  public koa?: Koa
  public router?: Router
  public server?: Server
  public socket?: WebSocket

  protected _isListening = false
  protected _isReady = false

  protected abstract _listen (): Promise<void>
  protected abstract _close (): void

  constructor (public app: App) {
    this.bots = createBotsProxy(app.options.bots)
    app.on('before-connect', this.listen.bind(this))
    app.on('before-disconnect', this.close.bind(this))
  }

  protected prepareMeta (data: any) {
    const meta = camelCase<Meta>(data)
    if (!this.bots[meta.selfId]) {
      const bot = this.bots.find(bot => !bot.selfId)
      if (!bot) return
      bot.selfId = meta.selfId
      this.app.prepare()
      this.ready()
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
    if (meta.subType) {
      events.unshift(events[0] + '/' + meta.subType)
    }

    // generate path
    meta.$app = this.app
    meta.$ctxId = ctxId
    meta.$ctxType = ctxType

    return events
  }

  dispatchMeta (meta: Meta) {
    const events = this.parseMeta(meta)
    for (const event of events) {
      this.app.emit(meta, paramCase<any>(event), meta)
    }
  }

  async listen () {
    if (this._isListening) return
    this._isListening = true
    try {
      await this._listen()
      this.app.prepare()
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
    if (this._isReady || !this.bots.every(bot => bot.selfId || !bot.sender)) return
    this._isReady = true
    this.app.emit('ready')
  }
}

class HttpServer extends CQServer {
  constructor (app: App) {
    super(app)

    const { secret, path = '/' } = app.options
    this.koa = new (require('koa'))()
    this.router = new (require('koa-router'))()
    this.koa.use(require('koa-bodyparser')())
    this.koa.use(this.router.routes())
    this.koa.use(this.router.allowedMethods())
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
      const meta = this.prepareMeta(ctx.request.body)
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
      this.dispatchMeta(meta)
    })
  }

  private async __listen (bot: Bot) {
    if (!bot.server) return
    const sender = bot.sender = new CQSender(this.app, bot)
    sender._get = async (action, params) => {
      const headers = {} as any
      if (bot.token) {
        headers.Authorization = `Token ${bot.token}`
      }
      const uri = new URL(action, bot.server).href
      const { data } = await axios.get(uri, { params, headers })
      return data
    }
    sender.info = await sender.getVersionInfo()
    if (sender.versionLessThan(4)) {
      throw new Error(
        `your cqhttp version (${sender.info.pluginVersion}) is not compatible ` +
        `with koishi, please upgrade your cqhttp to 4.0.0 or above.`)
    }
  }

  async _listen () {
    logger.debug('http server opening')
    const { port } = this.app.options
    if (!port) return
    this.server = this.koa.listen(port)
    await Promise.all(this.bots.map(bot => this.__listen(bot)))
    logger.debug('http server listen to', port)
  }

  _close () {
    this.server.close()
    logger.debug('http server closed')
  }
}

let counter = 0

class WsClient extends CQServer {
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

  private async __listen (bot: Bot) {
    const connect = (resolve: () => void, reject: (reason: Error) => void) => {
      logger.debug('websocket client opening')
      const headers: Record<string, string> = {}
      const { token, server } = bot
      if (!server) return
      const { retryInterval, retryTimes } = this.app.options
      if (token) headers.Authorization = `Bearer ${token}`
      this.socket = new (require('ws'))(server, { headers })

      this.socket.on('error', error => logger.debug(error))

      this.socket.once('close', (code) => {
        if (!this._isListening || code === 1005) return

        const message = `failed to connect to ${server}`
        if (!retryInterval || this._retryCount >= retryTimes) {
          return reject(new Error(message))
        }

        this._retryCount++
        logger.debug(`${message}, will retry in ${ms(retryInterval)}...`)
        setTimeout(() => {
          if (this._isListening) connect(resolve, reject)
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
          logger.debug('receive', data)
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
            const sender = bot.sender = new CQSender(this.app, bot)
            sender.info = camelCase(parsed.data)
            sender._get = (action, params) => this.send({ action, params })
            if (sender.versionLessThan(4)) {
              throw new Error(
                `your cqhttp version (${sender.info.pluginVersion}) is not compatible ` +
                `with koishi, please upgrade your cqhttp to 4.0.0 or above.`)
            }
            logger.debug('connect to ws server:', bot.server)
            resolve()
          } else {
            this._listeners[parsed.echo]?.(parsed)
          }
        })
      })
    }
    return new Promise(connect)
  }

  async _listen () {
    await Promise.all(this.bots.map(bot => this.__listen(bot)))
  }

  _close () {
    this.socket.close()
    this._retryCount = 0
    logger.debug('websocket client closed')
  }
}

export namespace CQServer {
  export type Type = keyof typeof types

  export const types = {
    http: HttpServer,
    ws: WsClient,
  }
}
