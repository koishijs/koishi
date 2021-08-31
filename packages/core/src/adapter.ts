import { Logger, paramCase, sleep, Dict } from '@koishijs/utils'
import { Session } from './session'
import { App } from './app'
import { Context, Plugin } from './context'

export abstract class Adapter<T extends Bot = Bot> {
  public bots: T[] = []
  public platform: string

  abstract start(): Promise<void>
  abstract stop?(): void

  constructor(public app: App, private Bot?: Bot.Constructor<T>) {}

  create(variant: string, options: Bot.Options, constructor = this.Bot) {
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

  export function join(platform: string, variant: string) {
    return variant ? `${platform}#${variant}` : platform
  }

  export function resolve(app: App, platform: string, bot: Bot.Options, options?: {}) {
    const type = join(platform, bot.protocol)
    if (app.adapters[type]) return app.adapters[type]
    const constructor = library[type]
    if (!constructor) {
      throw new Error(`unsupported protocol "${bot.protocol}"`)
    }
    if (!constructor[redirect]) {
      const adapter = new constructor(app, options)
      adapter.platform = platform
      return app.adapters[type] = adapter
    }
    logger.debug('infer protocol as %c', bot.protocol = constructor[redirect](bot))
    return resolve(app, platform, bot, options)
  }

  export type BotConfig<R> = R & { bots?: R[] }
  export type VariantConfig<B> = B & { variants?: Dict<B> }
  export type Config<R = any, S = any> = S & VariantConfig<BotConfig<R>>

  export function createPlugin<T extends Bot, R, S>(
    platform: string,
    bot: Bot.Constructor<T, R>,
    adapter: Constructor<T, S>,
  ): Plugin.Object<Config<R, S>>

  export function createPlugin<T extends Bot, R, S, K extends string>(
    platform: string,
    bot: Bot.Constructor<T, R>,
    adapters: Record<K, Constructor<T, S>>,
    redirect: (bot: R) => K,
  ): Plugin.Object<Config<R, S>>

  export function createPlugin(platform: string, bot: Bot.Constructor, ...args: [Constructor] | [Dict<Constructor>, (bot: any) => string]) {
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
      apply(ctx: Context, config: Config = {}) {
        const variants = config.variants || { '': config }
        for (const key in variants) {
          const config = variants[key]
          const bots = config.bots || [config]
          for (const options of bots) {
            ctx.bots.create('onebot', options)
          }
        }
      }
    }
  }
}

export class BotList extends Array<Bot> {
  constructor(private app: App) {
    super()
  }

  get(sid: string) {
    return this.find(bot => bot.sid === sid)
  }

  create(host: string, options: Bot.Options): Promise<Bot> {
    const [platform, variant] = host.split('#')
    const adapter = Adapter.resolve(this.app, platform as never, options)
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
}

export interface Bot extends Bot.Options, Bot.Methods, Bot.UserBase {}

export class Bot {
  readonly app: App
  readonly logger: Logger
  readonly platform: string

  status: Bot.Status
  version?: string
  selfId?: string
  variant?: string
  onConnectSuccess?: (bot: Bot) => void
  onConnectFailure?: (bot: Bot) => void

  constructor(public adapter: Adapter, options: Bot.Options) {
    Object.assign(this, options)
    this.app = adapter.app
    this.platform = adapter.platform as never
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
  export interface Options {
    protocol?: string
  }

  export type Constructor<T extends Bot = Bot, R = Options> = new (adapter: Adapter<T>, options: R) => T

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
