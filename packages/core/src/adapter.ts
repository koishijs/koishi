import { Logger, Schema, paramCase, Dict, Awaitable } from '@koishijs/utils'
import { Session } from './session'
import { App } from './app'
import { Bot } from './bot'
import { Context, Plugin } from './context'

export abstract class Adapter<S extends Bot.BaseConfig = Bot.BaseConfig, T = {}> {
  public bots: Bot<S>[] = []
  public platform: string

  abstract connect(bot: Bot): Awaitable<void>
  abstract start(): Awaitable<void>
  abstract stop(): Awaitable<void>

  constructor(public app: App, public config: T) {
    app.before('connect', async () => {
      await this.start()
      for (const bot of this.bots) {
        bot.connect()
      }
    })

    app.on('disconnect', () => this.stop())
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

const logger = new Logger('app')

export namespace Adapter {
  export interface Constructor<T extends Bot.BaseConfig = Bot.BaseConfig, S = any> {
    new (app: App, options?: S): Adapter<T>
    [redirect]?(bot: any): string
    schema?: Schema<S>
  }

  export const redirect = Symbol('koishi.adapter.redirect')
  export const library: Dict<Constructor> = {}
  export const configMap: Dict = {}

  export type BotConfig<R> = R & { bots?: R[] }
  export type PluginConfig<S = any, R = any> = S & BotConfig<R>

  function join(platform: string, protocol: string) {
    return protocol ? `${platform}.${protocol}` : platform
  }

  type CreatePluginRestParams = [Constructor] | [Dict<Constructor>, (bot: any) => string, Schema?]

  export function define<T extends Bot.BaseConfig, S>(
    platform: string,
    bot: Bot.Constructor<T>,
    adapter: Constructor<T, S>,
  ): Plugin.Object<PluginConfig<S, T>>

  export function define<T extends Bot.BaseConfig, S, K extends string>(
    platform: string,
    bot: Bot.Constructor<T>,
    adapters: Record<K, Constructor<T, S>>,
    redirect: (config: T) => K,
    schema?: Schema<S>,
  ): Plugin.Object<PluginConfig<S, T>>

  export function define(platform: string, constructor: Bot.Constructor, ...args: CreatePluginRestParams) {
    const botSchema = constructor.schema
    Bot.library[platform] = constructor

    let adapterSchema: Schema
    if (args.length === 1) {
      library[platform] = args[0]
      adapterSchema = args[0].schema
    } else {
      for (const protocol in args[0]) {
        library[join(platform, protocol)] = args[0][protocol]
      }
      library[platform] = { [redirect]: args[1] } as Constructor
      adapterSchema = args[2]
    }

    const schema = Schema.merge([
      adapterSchema,
      Schema.adapt(
        Schema.object({ bots: Schema.array(botSchema).hidden() }),
        botSchema,
        config => ({ bots: [config] }),
      ),
    ])

    function apply(ctx: Context, config: PluginConfig = {}) {
      configMap[platform] = config
      const bots = config.bots || [config]
      for (const options of bots) {
        const bot = ctx.bots.create(platform, options)
        bot.start().then((bot) => {
          logger.success('logged in to %s as %c (%s)', bot.platform, bot.username, bot.selfId)
        }, (error: Error) => {
          logger.error(error)
        })
      }
    }

    return { name: platform, schema, apply }
  }

  export class Manager extends Array<Bot> {
    adapters: Dict<Adapter> = {}

    constructor(private app: App) {
      super()
    }

    get(sid: string) {
      return this.find(bot => bot.sid === sid)
    }

    create(platform: string, options: Bot.BaseConfig, constructor: Bot.Constructor = Bot.library[platform]) {
      const adapter = this.resolve(platform, options)
      const bot = new constructor(adapter, options)
      adapter.bots.push(bot)
      this.push(bot)
      return bot
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
