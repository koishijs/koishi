import { Logger, paramCase, Dict } from '@koishijs/utils'
import { Session } from './session'
import { App } from './app'
import { Bot } from './bot'
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
