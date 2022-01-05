import { Logger, sleep, Dict } from '@koishijs/utils'
import { Adapter } from './adapter'
import { App } from './app'
import { Session } from './session'
import Schema from 'schemastery'

const logger = new Logger('bot')

export interface Bot extends Bot.BaseConfig, Bot.Methods, Bot.UserBase {}

export abstract class Bot<T extends Bot.BaseConfig = Bot.BaseConfig> {
  readonly app: App
  readonly logger: Logger
  readonly platform: string

  private _status: Bot.Status

  internal?: any
  selfId?: string
  error?: Error

  constructor(public adapter: Adapter, public config: T) {
    this.app = adapter.ctx.app
    this.platform = config.platform || adapter.platform
    this.logger = new Logger(adapter.platform)
    this._status = 'offline'

    adapter.ctx.on('ready', () => this.start())
    adapter.ctx.on('dispose', () => this.stop())
  }

  get status() {
    return this._status
  }

  set status(value) {
    this._status = value
    if (this.app.bots.includes(this)) {
      this.app.emit('bot-status-updated', this)
    }
  }

  resolve() {
    this.status = 'online'
    logger.success('logged in to %s as %c (%s)', this.platform, this.username, this.selfId)
  }

  reject(error: Error) {
    this.error = error
    this.status = 'offline'
    logger.error(error)
  }

  async start() {
    try {
      this.status = 'connect'
      await this.app.parallel('bot-connect', this)
      await this.adapter.connect(this)
    } catch (error) {
      this.reject(error)
    }
  }

  async stop() {
    this.status = 'disconnect'
    try {
      await this.app.parallel('bot-disconnect', this)
      await this.adapter.disconnect(this)
    } catch (error) {
      this.logger.warn(error)
    }
    this.status = 'offline'
  }

  get sid() {
    return `${this.platform}:${this.selfId}`
  }

  createSession(session: Partial<Session>) {
    return new Session(this, {
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
    disabled?: boolean
    protocol?: string
    platform?: string
  }

  export const library: Dict<Constructor> = {}

  export interface Constructor<S extends Bot.BaseConfig = Bot.BaseConfig> {
    new (adapter: Adapter, config: S): Bot<S>
    schema?: Schema
  }

  export type Status = 'offline' | 'online' | 'connect' | 'disconnect' | 'reconnect'

  export interface Methods {
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
    getChannel(channelId: string, guildId?: string): Promise<Channel>
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
    subtype?: 'private' | 'group'
  }
}
