import { Logger, paramCase, sleep, Dict } from '@koishijs/utils'
import { Session } from './session'
import { App } from './app'
import { Context, Plugin } from './context'

export abstract class Adapter<S extends Bot = Bot, T = {}> {
  public bots: S[] = []
  public platform: string

  abstract start(): Promise<void>
  abstract stop?(): void

  constructor(public app: App, private Bot: Bot.Constructor<S>, public config: T) {}

  create(variant: string, options: Bot.GetConfig<S>, constructor = this.Bot) {
    const bot = new constructor(this, options)
    bot.variant = variant
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
  export interface Constructor<T extends Bot = Bot, S = any> {
    [redirect]?(bot: any): string
    new (app: App, options?: S): Adapter<T>
  }

  const redirect = Symbol('koishi.adapter.redirect')
  const library: Dict<Constructor> = {}
  const configMap: Dict = {}

  export function join(platform: string, variant: string) {
    return variant ? `${platform}#${variant}` : platform
  }

  export type BotConfig<R> = R & { bots?: R[] }
  export type VariantConfig<B> = B & { variants?: Dict<B> }
  export type PluginConfig<S = any, R = any> = S & VariantConfig<BotConfig<R>>

  export function createPlugin<T extends Bot, S>(
    platform: string,
    adapter: Constructor<T, S>,
  ): Plugin.Object<PluginConfig<S, Bot.GetConfig<T>>>

  export function createPlugin<T extends Bot, S, K extends string>(
    platform: string,
    adapters: Record<K, Constructor<T, S>>,
    redirect: (config: Bot.GetConfig<T>) => K,
  ): Plugin.Object<PluginConfig<S, Bot.GetConfig<T>>>

  export function createPlugin(platform: string, ...args: [Constructor] | [Dict<Constructor>, (bot: any) => string]) {
    if (args.length === 1) {
      library[platform] = args[0]
    } else {
      for (const protocol in args[0]) {
        library[join(platform, protocol)] = args[0][protocol]
      }
      library[platform] = { [redirect]: args[1] } as Constructor
    }

    return {
      name: platform,
      apply(ctx: Context, config: PluginConfig = {}) {
        configMap[platform] = config
        const variants = config.variants || { '': config }
        for (const key in variants) {
          const config = variants[key]
          const bots = config.bots || [config]
          for (const options of bots) {
            ctx.bots.create(platform, options)
          }
        }
      }
    }
  }

  export class Manager extends Array<Bot> {
    adapters: Dict<Adapter> = {}

    constructor(private app: App) {
      super()
    }

    get(sid: string) {
      return this.find(bot => bot.sid === sid)
    }

    create(host: string, options: Bot.BaseConfig): Promise<Bot> {
      const [platform, variant] = host.split('#')
      const adapter = this.resolve(platform, options)
      const bot = adapter.create(variant, options)
      return new Promise((resolve, reject) => {
        bot.onConnectSuccess = resolve
        bot.onConnectFailure = reject
      })
    }

    remove(sid: string) {
      const index = this.findIndex(bot => bot.sid === sid)
      if (index < 0) return false
      this.splice(index, 1)
      return true
    }

    private resolve(platform: string, bot: Bot.BaseConfig): Adapter {
      const type = join(platform, bot.protocol)
      if (this.adapters[type]) return this.adapters[type]
      const constructor = library[type]
      if (!constructor) {
        throw new Error(`unsupported protocol "${bot.protocol}"`)
      }
      if (!constructor[redirect]) {
        const adapter = new constructor(this.app, configMap[platform])
        adapter.platform = platform
        return this.adapters[type] = adapter
      }
      logger.debug('infer protocol as %c', bot.protocol = constructor[redirect](bot))
      return this.resolve(platform, bot)
    }
  }
}

export interface Bot<T> extends Bot.BaseConfig, Bot.Methods, Bot.UserBase {}

export class Bot<T extends Bot.BaseConfig = Bot.BaseConfig> {
  readonly app: App
  readonly logger: Logger
  readonly platform: string

  status: Bot.Status
  selfId?: string
  variant?: string
  onConnectSuccess?: (bot: Bot) => void
  onConnectFailure?: (bot: Bot) => void

  constructor(public adapter: Adapter, public config: T) {
    this.app = adapter.app
    this.platform = adapter.platform
    this.logger = new Logger(this.platform)
    this.status = Bot.Status.BOT_IDLE
  }

  get host() {
    return Adapter.join(this.platform, this.variant)
  }

  get sid() {
    return `${this.host}:${this.selfId}`
  }

  async getStatus() {
    return this.status
  }

  createSession(session: Partial<Session<never, never, 'send'>>) {
    return new Session<never, never, 'send'>(this.app, {
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
  }

  export type GetConfig<S extends Bot = Bot> = S extends Bot<infer R> ? R : never
  export type Constructor<S extends Bot = Bot> = new (adapter: Adapter<S>, config: GetConfig<S>) => S

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
