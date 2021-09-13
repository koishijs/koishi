import { Logger, sleep, Schema, Dict } from '@koishijs/utils'
import { Adapter } from './adapter'
import { App } from './app'
import { Session } from './session'

export interface Bot extends Bot.BaseConfig, Bot.Methods, Bot.UserBase {}

export abstract class Bot<T extends Bot.BaseConfig = Bot.BaseConfig> {
  readonly app: App
  readonly logger: Logger
  readonly platform: string

  status: Bot.Status
  selfId?: string

  resolve?: () => void
  reject?: (error: Error) => void

  constructor(public adapter: Adapter, public config: T) {
    this.app = adapter.app
    this.platform = config.platform || adapter.platform
    this.logger = new Logger(adapter.platform)
    this.status = Bot.Status.BOT_IDLE
  }

  async connect() {
    try {
      await this.adapter.connect(this)
    } catch (error) {
      this.reject(error)
    }
  }

  start() {
    const task = new Promise<this>((resolve, reject) => {
      this.resolve = () => {
        this.status = Bot.Status.GOOD
        resolve(this)
      }
      this.reject = (error) => {
        this.status = Bot.Status.BOT_IDLE
        reject(error)
      }
    })

    if (this.app.status === App.Status.open) {
      this.connect()
    }
    return task
  }

  get sid() {
    return `${this.platform}:${this.selfId}`
  }

  async getStatus() {
    return this.status
  }

  createSession(session: Partial<Session<never, never, 'send'>>) {
    return new Session<never, never, 'send'>(this, {
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

  async getGuildMemberMap(guildId: string) {
    const list = await this.getGuildMemberList(guildId)
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
  export interface BaseConfig {
    protocol?: string
    platform?: string
  }

  export const library: Dict<Constructor> = {}
  export const schema = Schema.object<{}>({
    platform: Schema.string({ desc: '平台名称' }),
  }, { desc: '高级设置' })

  export interface Constructor<S extends Bot.BaseConfig = Bot.BaseConfig, T = any> {
    new (adapter: Adapter, config: S): Bot<S>
    schema?: Schema<S>
  }

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

  export interface Methods {
    getStatus(): Promise<Status>

    // message
    sendMessage(channelId: string, content: string, guildId?: string): Promise<string>
    sendPrivateMessage(userId: string, content: string): Promise<string>
    getMessage(channelId: string, messageId: string): Promise<Message>
    editMessage(channelId: string, messageId: string, content: string): Promise<void>
    deleteMessage(channelId: string, messageId: string): Promise<void>

    // user
    getSelf(): Promise<User>
    getUser(userId: string): Promise<User>
    getFriendList(): Promise<User[]>
    deleteFriend(userId: string): Promise<void>

    // guild
    getGuild(guildId: string): Promise<Guild>
    getGuildList(): Promise<Guild[]>

    // guild member
    getGuildMember(guildId: string, userId: string): Promise<GuildMember>
    getGuildMemberList(guildId: string): Promise<GuildMember[]>

    // channel
    getChannel(channelId: string): Promise<Channel>
    getChannelList(guildId: string): Promise<Channel[]>

    // request
    handleFriendRequest(messageId: string, approve: boolean, comment?: string): Promise<void>
    handleGuildRequest(messageId: string, approve: boolean, comment?: string): Promise<void>
    handleGuildMemberRequest(messageId: string, approve: boolean, comment?: string): Promise<void>
  }

  export interface Channel {
    channelId: string
    channelName?: string
  }

  export interface Guild {
    guildId: string
    guildName?: string
  }

  export interface UserBase {
    username?: string
    nickname?: string
    avatar?: string
    discriminator?: string
    isBot?: boolean
  }

  export interface User extends UserBase {
    userId: string
  }

  export interface GuildMember extends User {
    roles?: string[]
  }

  export interface Author extends GuildMember {
    anonymous?: string
  }

  export interface Role {
    id: string
  }

  export interface MessageBase {
    messageId?: string
    channelId?: string
    guildId?: string
    userId?: string
    content?: string
    timestamp?: number
    author?: Author
    quote?: Message
  }

  export interface Message extends MessageBase {
    subtype?: keyof Session.Events['message']
  }
}
