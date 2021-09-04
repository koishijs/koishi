import { Logger, paramCase, Dict, Awaitable } from '@koishijs/utils'
import { Session } from './session'
import { App } from './app'
import { Bot } from './bot'
import { Context, Plugin } from './context'

export abstract class Adapter<S extends Bot = Bot, T = {}> {
  public bots: S[] = []
  public platform: string

  abstract connect(bot: Bot): Awaitable<void>
  abstract start(): Awaitable<void>
  abstract stop(): Awaitable<void>

  constructor(public app: App, private Bot: Bot.Constructor<S>, public config: T) {
    app.before('connect', async () => {
      await this.start()
      for (const bot of this.bots) {
        bot.connect()
      }
    })

    app.on('disconnect', () => this.stop())
  }

  create(options: Bot.GetConfig<S>, constructor = this.Bot) {
    const bot: S = new constructor(this, options)
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

  export type BotConfig<R> = R & { bots?: R[] }
  export type PluginConfig<S = any, R = any> = S & BotConfig<R>

  function join(platform: string, protocol: string) {
    return protocol ? `${platform}.${protocol}` : platform
  }

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

    function apply(ctx: Context, config: PluginConfig = {}) {
      configMap[platform] = config
      const bots = config.bots || [config]
      for (const options of bots) {
        const bot = ctx.bots.create(platform, options)
        bot.start().then((bot) => {
          logger.success('logged in to %s as %c (%s)', bot.variant, bot.username, bot.selfId)
        }, (error: Error) => {
          logger.error(error)
        })
      }
    }

    return { name: platform, apply }
  }

  export class Manager extends Array<Bot> {
    adapters: Dict<Adapter> = {}

    constructor(private app: App) {
      super()
    }

    get(sid: string) {
      return this.find(bot => bot.sid === sid)
    }

    create(platform: string, options: Bot.BaseConfig) {
      const adapter = this.resolve(platform, options)
      return adapter.create(options)
    }

    remove(sid: string) {
      const index = this.findIndex(bot => bot.sid === sid)
      if (index < 0) return false
      this.splice(index, 1)
      return true
    }

    private resolve(platform: string, config: Bot.BaseConfig): Adapter {
      const type = join(platform, config.protocol)
      if (this.adapters[type]) return this.adapters[type]

      const constructor = library[type]
      if (!constructor) {
        throw new Error(`unsupported protocol "${type}"`)
      }

      if (constructor[redirect]) {
        config.protocol = constructor[redirect](config)
        return this.resolve(platform, config)
      }

      const adapter = new constructor(this.app, configMap[platform])
      adapter.platform = platform
      return this.adapters[type] = adapter
    }
  }
}
