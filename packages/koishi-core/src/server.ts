import { CQCode, paramCase, sleep } from 'koishi-utils'
import { Session, MessageInfo, EventTypeMap, GroupInfo, GroupMemberInfo, UserInfo } from './session'
import { App, AppStatus } from './app'
import { PlatformType } from './database'

export interface BotOptions {
  type?: string
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

type BotStatic<T extends Bot = Bot> = new (app: App, options: BotOptions) => T

export abstract class Server<T extends Bot = Bot> {
  static types: Record<string, new (app: App) => Server> = {}

  public bots = createBots<T>('selfId')

  abstract listen(): Promise<void>
  abstract close(): void

  constructor(public app: App, private BotStatic: BotStatic<T>) {}

  create(options: BotOptions) {
    const bot = new this.BotStatic(this.app, options)
    this.bots.push(bot)
    this.app.bots.push(bot)
  }

  dispatch(session: Session) {
    if (this.app.status !== AppStatus.open) return
    const events: string[] = []
    events.push(session.eventType)
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
  [Bot.send](session: Session, message: string): Promise<void>

  ready?: boolean
  version?: string
  platform?: PlatformType
  getSelfId(): Promise<string>
  getStatusCode(): Promise<BotStatusCode>

  // message
  sendMessage(channelId: string, content: string): Promise<string>
  sendPrivateMessage(userId: string, content: string): Promise<string>
  getMessage(channelId: string, messageId: string): Promise<MessageInfo>
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

export class Bot {
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

  constructor(public app: App, options: BotOptions) {
    Object.assign(this, options)
    this.platform = this.type.split(':', 1)[0] as never
  }

  get sid() {
    return `${this.platform}:${this.selfId}`
  }

  createSession(subType: EventTypeMap['message'], ctxType: 'group' | 'user', ctxId: string, content: string) {
    return new Session(this.app, {
      content,
      subType,
      eventType: 'send',
      platform: this.platform,
      selfId: this.selfId,
      [ctxType + 'Id']: ctxId,
      timestamp: Math.round(Date.now() / 1000),
    })
  }

  async getGroupMemberMap(groupId: string) {
    const list = await this.getGroupMemberList(groupId)
    return Object.fromEntries(list.map(info => [info.userId, info.nick || info.name]))
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
