import { CQCode, Logger, paramCase, sleep, Time } from 'koishi-utils'
import { Session, MessageInfo, GroupInfo, GroupMemberInfo, UserInfo } from './session'
import { App } from './app'
import type WebSocket from 'ws'

export interface BotOptions {
  type?: string
  token?: string
  selfId?: string
}

export function createBots<T extends Bot>(key: 'selfId' | 'sid') {
  const bots = [] as Array<T> & Record<string, T>
  return new Proxy(bots, {
    get(target, prop) {
      return typeof prop === 'symbol'
        ? Reflect.get(target, prop)
        : target[prop] || target.find(bot => bot[key] === prop)
    },
  })
}

export type At<O, T extends keyof O, F> = [T] extends [never] ? F : O[T]

type BotInstance<T extends Platform> = At<Bot.Platforms, T, Bot<T>>
type BotConstructor<T extends Platform> = new (adapter: Adapter, options: BotOptions) => BotInstance<T>
type AdapterConstructor<T extends Platform = Platform> = new (app: App, bot: BotOptions) => Adapter<T>

export abstract class Adapter<P extends Platform = Platform> {
  public type: string
  public bots = createBots<BotInstance<P>>('selfId')

  abstract listen(): Promise<void>
  abstract close(): void

  constructor(public app: App, private Bot: BotConstructor<P>) {}

  create(options: BotOptions) {
    const bot = new this.Bot(this, options)
    this.bots.push(bot)
    this.app.bots.push(bot)
  }

  dispatch(session: Session) {
    if (this.app.status !== App.Status.open) return
    const events: string[] = [session.type]
    if (session.subtype) {
      events.unshift(events[0] + '/' + session.subtype)
      if (session.subsubtype) {
        events.unshift(events[0] + '/' + session.subsubtype)
      }
    }
    for (const event of events) {
      this.app.emit(session, paramCase<any>(event), session)
    }
  }
}

const logger = new Logger('server')

export namespace Adapter {
  export type Instances = {
    [K in string]: K extends `${infer T}:${any}` ? Adapter<T & Platform> : Adapter<K & Platform>
  }

  export const types: Record<string, AdapterConstructor> = {}

  export function redirect(target: string | ((bot: BotOptions) => string)) {
    const callback = typeof target === 'string' ? () => target : target
    return class {
      constructor(app: App, bot: BotOptions) {
        const type = bot.type = callback(bot)
        new Logger('server').info('infer type as %c', type)
        return app.adapters[type] || new Adapter.types[type](app, bot)
      }
    } as AdapterConstructor
  }

  export interface WsClientOptions {
    retryTimes?: number
    retryInterval?: number
  }

  export abstract class WsClient<P extends Platform = Platform> extends Adapter<P> {
    abstract createSocket(bot: BotInstance<P>): WebSocket | Promise<WebSocket>
    abstract connect(bot: BotInstance<P>): Promise<void>

    constructor(app: App, Bot: BotConstructor<P>, public options: WsClientOptions) {
      super(app, Bot)
    }

    private async _listen(bot: BotInstance<P>) {
      let _retryCount = 0
      const { retryTimes, retryInterval } = this.options

      const connect = async (resolve: (value: void) => void, reject: (reason: Error) => void) => {
        logger.debug('websocket client opening')
        const socket = await this.createSocket(bot)

        socket.on('error', error => logger.debug(error))

        socket.on('close', (code, reason) => {
          bot.socket = null
          if (this.app.status !== App.Status.open || code === 1005) return

          const message = reason || `failed to connect to ${socket.url}`
          if (!retryInterval || _retryCount >= retryTimes) {
            return reject(new Error(message))
          }

          _retryCount++
          logger.warn(`${message}, will retry in ${Time.formatTimeShort(retryInterval)}...`)
          setTimeout(() => {
            if (this.app.status === App.Status.open) connect(resolve, reject)
          }, retryInterval)
        })

        socket.on('open', () => {
          _retryCount = 0
          bot.socket = socket
          logger.debug('connect to ws server:', socket.url)
          this.connect(bot).then(resolve, reject)
        })
      }

      return new Promise(connect)
    }

    async listen() {
      await Promise.all(this.bots.map(bot => this._listen(bot)))
    }

    close() {
      logger.debug('websocket client closing')
      for (const bot of this.bots) {
        bot.socket?.close()
      }
    }
  }
}

export interface Bot<P = Platform> extends BotOptions {
  [Bot.send](session: Session, message: string): Promise<void>

  ready?: boolean
  socket?: WebSocket
  version?: string
  username?: string
  platform?: P
  getStatusCode(): Promise<Bot.Status>

  // message
  sendMessage(channelId: string, content: string): Promise<string>
  sendPrivateMessage(userId: string, content: string): Promise<string>
  getMessage(channelId: string, messageId: string): Promise<MessageInfo>
  editMessage(channelId: string, messageId: string, content: string): Promise<void>
  deleteMessage(channelId: string, messageId: string): Promise<void>

  // user
  getUser(userId: string): Promise<UserInfo>

  // group
  getGroup(groupId: string): Promise<GroupInfo>
  getGroupList(): Promise<GroupInfo[]>

  // group member
  getGroupMember(groupId: string, userId: string): Promise<GroupMemberInfo>
  getGroupMemberList(groupId: string): Promise<GroupMemberInfo[]>
}

export class Bot<P extends Platform> {
  static readonly send = Symbol.for('koishi.send')

  parseUser(source: string) {
    if (/^\d+$/.test(source)) return source
    const code = CQCode.parse(source)
    if (code && code.type === 'at') {
      return code.data.qq
    }
  }

  parseChannel(source: string) {
    if (/^\d+$/.test(source)) return source
  }

  app: App

  constructor(public adapter: Adapter<P>, options: BotOptions) {
    Object.assign(this, options)
    this.app = adapter.app
    this.platform = this.type.split(':', 1)[0] as never
  }

  get sid() {
    return `${this.platform}:${this.selfId}`
  }

  createSession<T extends keyof Session.Events['send']>(subtype: T, ctxType: 'group' | 'user', ctxId: string, content: string) {
    return new Session<never, never, P, 'send', T>(this.app, {
      content,
      subtype,
      type: 'send',
      platform: this.platform,
      selfId: this.selfId,
      [ctxType + 'Id']: ctxId,
      timestamp: Math.round(Date.now() / 1000),
    })
  }

  async getGroupMemberMap(groupId: string) {
    const list = await this.getGroupMemberList(groupId)
    return Object.fromEntries(list.map(info => [info.userId, info.nickname || info.username]))
  }

  async broadcast(channels: string[], content: string, delay = this.app.options.delay.broadcast) {
    const messageIds: string[] = []
    for (let index = 0; index < channels.length; index++) {
      if (index && delay) await sleep(delay)
      try {
        messageIds.push(await this.sendMessage(channels[index], content))
      } catch (error) {
        this.app.logger('bot').warn(error)
      }
    }
    return messageIds
  }
}

export namespace Bot {
  export interface Platforms {}

  export enum Status {
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
}

export type Platform = keyof Bot.Platforms
