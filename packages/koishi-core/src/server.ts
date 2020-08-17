import { camelCase, paramCase } from 'koishi-utils'
import { Session, MessageType, Meta } from './session'
import { App } from './app'
import * as http from 'http'
import type Koa from 'koa'
import type Router from 'koa-router'

export interface BotOptions {
  server?: string
  selfId?: number
}

export abstract class Server {
  static types: Record<string, new (app: App) => Server> = {}

  public bots: Bot[]
  public router?: Router
  public server?: http.Server

  protected _listening = false
  protected abstract _listen(): Promise<void>
  protected abstract _close(): void

  constructor(public app: App) {
    app.on('before-connect', this.listen.bind(this))
    app.on('before-disconnect', this.close.bind(this))
    app.on('connect', this.success.bind(this))
    const senders = app.options.bots.map(bot => new Bot(app, bot))
    this.bots = new Proxy(senders, {
      get(target, prop) {
        return typeof prop === 'symbol' || +prop * 0 !== 0
          ? Reflect.get(target, prop)
          : target[prop] || target.find(bot => bot.selfId === +prop)
      },
      set(target, prop, value) {
        return typeof prop === 'symbol' || +prop * 0 !== 0
          ? Reflect.set(target, prop, value)
          : false
      },
    })
    if (app.options.port) this.createServer()
  }

  createServer() {
    const koa: Koa = new (require('koa'))()
    this.router = new (require('koa-router'))()
    koa.use(require('koa-bodyparser')())
    koa.use(this.router.routes())
    koa.use(this.router.allowedMethods())
    this.server = http.createServer(koa.callback())
  }

  prepare(data: any) {
    const meta = camelCase<Meta>(data)
    if (!this.bots[meta.selfId]) {
      const bot = this.bots.find(bot => !bot.selfId)
      if (!bot) return
      bot.selfId = meta.selfId
    }
    return new Session(this.app, meta)
  }

  dispatch(session: Session) {
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

  async listen() {
    if (this._listening) return
    this._listening = true
    try {
      await this._listen()
    } catch (error) {
      this.close()
      throw error
    }
  }

  success() {
    const { port } = this.app.options
    const logger = this.app.logger('app')
    if (port) logger.info('server listening at %c', port)

    this.bots.forEach(({ server }) => {
      if (server) logger.info('connected to %c', server)
    })
  }

  close() {
    this._listening = false
    this._close()
  }
}

export enum BotStatus {
  /** 正常运行 */
  GOOD,
  /** Bot 处于闲置状态 */
  BOT_IDLE,
  /** Bot 离线 */
  BOT_OFFLINE,
  /** 无法获得状态 */
  NET_ERROR,
  /** 服务器状态异常 */
  SERVER_ERROR,
}

export interface Bot extends BotOptions {
  ready?: boolean
  version?: string
  getSelfId (): Promise<number>
  getStatus (): Promise<BotStatus>
  getMemberMap (groupId: number): Promise<Record<number, string>>
  sendGroupMessage (groupId: number | number[], message: string, delay?: number): Promise<void>
  sendPrivateMessage (userId: number | number[], message: string, delay?: number): Promise<void>
}

export class Bot {
  constructor(public app: App, options: BotOptions) {
    Object.assign(this, options)
  }

  createSession(messageType: MessageType, ctxType: 'group' | 'user', ctxId: number, message: string) {
    return new Session(this.app, {
      message,
      messageType,
      postType: 'send',
      $app: this.app,
      selfId: this.selfId,
      [ctxType + 'Id']: ctxId,
      time: Math.round(Date.now() / 1000),
    })
  }
}
