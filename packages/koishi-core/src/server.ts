import { camelCase, paramCase } from 'koishi-utils'
import { Session, MessageType } from './session'
import { App } from './app'

export interface BotOptions {
  token?: string
  server?: string
  selfId?: number
}

export interface ServerTypes {}

export abstract class Server {
  static types: ServerTypes = {}

  public bots: Bot[]

  protected _isListening = false
  protected _isReady = false

  protected abstract _listen (): Promise<void>
  protected abstract _close (): void

  constructor (public app: App) {
    app.on('before-connect', this.listen.bind(this))
    app.on('before-disconnect', this.close.bind(this))
    const senders = app.options.bots.map(bot => new Bot(app, bot))
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
    // @ts-ignore
    if (this._isReady || !this.bots.every(bot => bot.selfId || !bot._get)) return
    this._isReady = true
    this.app.emit('ready')
  }
}

export interface VersionInfo {}

export interface Bot extends BotOptions {
  version?: VersionInfo
  getSelfId (): Promise<number>
  getVersion (): Promise<VersionInfo>
}

export class Bot {
  constructor (public app: App, bot: BotOptions) {
    Object.assign(this, bot)
  }

  createSession (messageType: MessageType, ctxType: 'group' | 'user', ctxId: number, message: string) {
    return new Session({
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
