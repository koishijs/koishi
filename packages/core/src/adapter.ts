import { Logger, paramCase, sleep } from '@koishijs/utils'
import { Session } from './session'
import { App } from './app'

export interface BotOptions {
  type?: string
  token?: string
  selfId?: string
}

type BotList<T extends Bot> = Array<T> & Record<string, T>

export function createBots<T extends Bot>(key: 'selfId' | 'sid') {
  const bots = [] as BotList<T>
  return new Proxy(bots, {
    get(target, prop) {
      return typeof prop === 'symbol'
        ? Reflect.get(target, prop)
        : target[prop] || target.find(bot => bot[key] === prop)
    },
  })
}

export abstract class Adapter<P extends Platform = Platform> {
  public bots: BotList<Bot.Instance<P>> = createBots('selfId')

  abstract start(): Promise<void>
  abstract stop?(): void

  constructor(public app: App, private Bot?: Bot.Constructor<P>) {}

  create(options: BotOptions, constructor = this.Bot) {
    const bot = new constructor(this, options)
    this.bots.push(bot)
    this.app.bots.push(bot)
    return bot
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

const logger = new Logger('adapter')

export namespace Adapter {
  export type Constructor<T extends Platform = Platform> = new (app: App, bot: BotOptions) => Adapter<T>

  export type Instances = {
    [K in string]: K extends `${infer T}:${any}` ? Adapter<T & Platform> : Adapter<K & Platform>
  }

  export const types: Record<string, Constructor> = {}

  export function from(app: App, bot: BotOptions) {
    const type = bot.type = bot.type.toLowerCase()
    if (app.adapters[type]) return app.adapters[type]
    const constructor = Adapter.types[type]
    if (!constructor) {
      const platform = type.split(':', 1)[0]
      throw new Error(`unsupported platform "${platform}", you should import the adapter yourself`)
    }
    const adapter = new constructor(app, bot)
    return app.adapters[bot.type] = adapter
  }

  export function redirect(target: string | ((bot: BotOptions) => string)) {
    const callback = typeof target === 'string' ? () => target : target
    return class {
      constructor(app: App, bot: BotOptions) {
        logger.debug('infer type as %c', bot.type = callback(bot))
        return from(app, bot)
      }
    } as Constructor
  }
}

export interface Bot<P = Platform> extends BotOptions, UserBase {
  [Session.send](session: Session, message: string): Promise<void>

  status: Bot.Status
  version?: string
  getStatus(): Promise<Bot.Status>

  // message
  sendMessage(channelId: string, content: string, groupId?: string): Promise<string>
  sendPrivateMessage(userId: string, content: string): Promise<string>
  getMessage(channelId: string, messageId: string): Promise<MessageInfo>
  editMessage(channelId: string, messageId: string, content: string): Promise<void>
  deleteMessage(channelId: string, messageId: string): Promise<void>

  // user
  getSelf(): Promise<UserInfo>
  getUser(userId: string): Promise<UserInfo>
  getFriendList(): Promise<UserInfo[]>
  deleteFriend(userId: string): Promise<void>

  // group
  getGroup(groupId: string): Promise<GroupInfo>
  getGroupList(): Promise<GroupInfo[]>

  // group member
  getGroupMember(groupId: string, userId: string): Promise<GroupMemberInfo>
  getGroupMemberList(groupId: string): Promise<GroupMemberInfo[]>

  // channel
  getChannel(channelId: string): Promise<ChannelInfo>
  getChannelList(groupId: string): Promise<ChannelInfo[]>

  // request
  handleFriendRequest(messageId: string, approve: boolean, comment?: string): Promise<void>
  handleGroupRequest(messageId: string, approve: boolean, comment?: string): Promise<void>
  handleGroupMemberRequest(messageId: string, approve: boolean, comment?: string): Promise<void>
}

export class Bot<P extends Platform> {
  readonly app: App
  readonly logger: Logger
  readonly platform: P
  readonly variant: string
  readonly domain: string

  constructor(public adapter: Adapter<P>, options: BotOptions) {
    Object.assign(this, options)
    this.app = adapter.app
    this.platform = this.type.split(':', 1)[0] as never
    this.logger = new Logger(this.platform)
    this.status = Bot.Status.BOT_IDLE
  }

  get sid() {
    return `${this.platform}:${this.selfId}`
  }

  async getStatus() {
    return this.status
  }

  createSession(session: Partial<Session<never, never, P, 'send'>>) {
    return new Session<never, never, P, 'send'>(this.app, {
      ...session,
      type: 'send',
      selfId: this.selfId,
      platform: this.platform,
      timestamp: Date.now(),
      author: {
        userId: this.selfId,
        username: this.username,
        avatar: this.avatar,
        discriminator: this.discriminator,
        isBot: true,
      },
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
        messageIds.push(await this.sendMessage(channels[index], content, 'unknown'))
      } catch (error) {
        this.app.logger('bot').warn(error)
      }
    }
    return messageIds
  }
}

export namespace Bot {
  export interface Platforms {}

  export type Instance<T extends Platform> = [T] extends [never] ? Bot<T> : Platforms[T]
  export type Constructor<T extends Platform> = new (adapter: Adapter, options: BotOptions) => Instance<T>

  export enum Status {
    /** 正常运行 */
    GOOD,
    /** 机器人处于闲置状态 */
    BOT_IDLE,
    /** 机器人离线 */
    BOT_OFFLINE,
    /** 无法获得状态 */
    NET_ERROR,
    /** 服务器状态异常 */
    SERVER_ERROR,
    /** 机器人被封禁 */
    BANNED,
    /** 正在尝试连接 */
    CONNECTING,
  }
}

export type Platform = keyof Bot.Platforms

export interface ChannelInfo {
  channelId: string
  channelName?: string
}

export interface GroupInfo {
  groupId: string
  groupName?: string
}

export interface UserBase {
  username?: string
  nickname?: string
  avatar?: string
  discriminator?: string
  isBot?: boolean
}

export interface UserInfo extends UserBase {
  userId: string
}

export interface GroupMemberInfo extends UserInfo {
  roles?: string[]
}

export interface AuthorInfo extends GroupMemberInfo {
  anonymous?: string
}

export interface RoleInfo {
  id: string
}

export interface MessageBase {
  messageId?: string
  channelId?: string
  groupId?: string
  userId?: string
  content?: string
  timestamp?: number
  author?: AuthorInfo
  quote?: MessageInfo
}

export interface MessageInfo extends MessageBase {
  subtype?: keyof Session.Events['message']
}
