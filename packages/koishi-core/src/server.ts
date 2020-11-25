import { paramCase, sleep } from 'koishi-utils'
import { Session, MessageType, MessageInfo } from './session'
import { App, AppStatus } from './app'

export interface BotOptions {
  type?: string
  selfId?: number
}

type BotStatic<T extends Bot = Bot> = new (app: App, options: BotOptions) => T

export abstract class Server<T extends Bot = Bot> {
  static types: Record<string, new (app: App) => Server> = {}

  public id: string
  public bots: T[] = []

  abstract listen(): Promise<void>
  abstract close(): void

  constructor(public app: App, private BotStatic: BotStatic<T>) {}

  create(options: BotOptions) {
    const bot = new this.BotStatic(this.app, options)
    this.bots.push(bot)
    this.app.bots[bot.selfId] = bot
  }

  dispatch(session: Session) {
    if (this.app.status !== AppStatus.open) return
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
}

export enum BotStatusCode {
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
  [Bot.$send](session: Session, message: string): Promise<void>
  ready?: boolean
  version?: string
  getMsg(messageId: number): Promise<MessageInfo>
  getSelfId(): Promise<number>
  getStatusCode(): Promise<BotStatusCode>
  getMemberMap(groupId: number): Promise<Record<number, string>>
  sendGroupMsg(groupId: number, message: string, autoEscape?: boolean): Promise<number>
  sendPrivateMsg(userId: number, message: string, autoEscape?: boolean): Promise<number>
}

export class Bot {
  static readonly $send = Symbol.for('koishi.send')

  constructor(public app: App, options: BotOptions) {
    Object.assign(this, options)
  }

  createSession(messageType: MessageType, ctxType: 'group' | 'user', ctxId: number, message: string) {
    return new Session(this.app, {
      message,
      messageType,
      postType: 'send',
      selfId: this.selfId,
      [ctxType + 'Id']: ctxId,
      time: Math.round(Date.now() / 1000),
    })
  }

  async broadcast(groups: number[], message: string, delay = this.app.options.broadcastDelay) {
    const messageIds: number[] = []
    for (let index = 0; index < groups.length; index++) {
      if (index && delay) await sleep(delay)
      try {
        messageIds.push(await this.sendGroupMsg(groups[index], message))
      } catch (error) {
        this.app.logger('bot').warn(error)
      }
    }
    return messageIds
  }
}
