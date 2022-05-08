import { Awaitable, Dict, Logger, paramCase, remove, Schema } from '@koishijs/utils'
import { Session } from './session'
import { App } from './app'
import { Bot } from './bot'
import { Context, Plugin } from './context'

export abstract class Adapter<S extends Bot.BaseConfig = Bot.BaseConfig, T = {}> {
  public bots: Bot<S>[] = []
  public platform: string

  protected abstract start(): Awaitable<void>
  protected abstract stop(): Awaitable<void>

  constructor(public ctx: Context, public config: T) {
    ctx.on('ready', () => this.start())
    ctx.on('dispose', () => this.stop())
  }

  connect(bot: Bot): Awaitable<void> {}
  disconnect(bot: Bot): Awaitable<void> {}

  dispatch(session: Session) {
    if (!this.ctx.app.isActive) return
    const events: string[] = [session.type]
    if (session.subtype) {
      events.unshift(events[0] + '/' + session.subtype)
      if (session.subsubtype) {
        events.unshift(events[0] + '/' + session.subsubtype)
      }
    }
    for (const event of events) {
      this.ctx.emit(session, paramCase<any>(event), session)
    }
  }
}

const logger = new Logger('app')

export namespace Adapter {
  export interface Constructor<T extends Bot.BaseConfig = Bot.BaseConfig, S = any> {
    new (ctx: Context, options?: S): Adapter<T>
    [redirect]?(bot: any): string
    schema?: Schema
  }

  export const redirect = Symbol('koishi.adapter.redirect')
  export const library: Dict<Constructor> = {}
  export const configMap: Dict = {}

  export type BotConfig<R> = R & { bots?: R[] }
  export type PluginConfig<S = any, R = any> = S & BotConfig<R>

  export function join(platform: string, protocol: string) {
    return protocol ? `${platform}.${protocol}` : platform
  }

  type CreatePluginRestParams = [Constructor] | [Dict<Constructor>, ((bot: any) => string)?]

  export function define<T extends Bot.BaseConfig, S>(
    platform: string,
    bot: Bot.Constructor<T>,
    adapter: Constructor<T, S>,
  ): Plugin.Object<PluginConfig<S, T>>

  export function define<T extends Bot.BaseConfig, S, K extends string>(
    platform: string,
    bot: Bot.Constructor<T>,
    adapters: Record<K, Constructor<T, S>>,
    redirect?: (config: T) => K,
  ): Plugin.Object<PluginConfig<S, T>>

  export function define(platform: string, constructor: Bot.Constructor, ...args: CreatePluginRestParams) {
    const name = platform + '-adapter'
    platform = platform.toLowerCase()
    Bot.library[platform] = constructor

    let BotConfig: Schema
    if (typeof args[0] === 'function') {
      library[platform] = args[0]
      BotConfig = args[0].schema
    } else {
      library[platform] = { [redirect]: args[1] } as Constructor
      BotConfig = library[platform].schema = Schema.union([]).description('机器人要使用的协议。')
      const FlatConfig = Schema.object({ protocol: Schema.string() })
      function flatten(schema: Schema) {
        if (schema.type === 'union' || schema.type === 'intersect') {
          schema.list.forEach(flatten)
        } else if (schema.type === 'object') {
          for (const key in schema.dict) {
            FlatConfig.dict[key] = new Schema(schema.dict[key])
            FlatConfig.dict[key].meta = { ...schema.dict[key].meta, required: false }
          }
        } else {
          throw new Error('cannot flatten bot schema')
        }
      }

      for (const protocol in args[0]) {
        library[join(platform, protocol)] = args[0][protocol]
        flatten(args[0][protocol].schema)
        BotConfig.list.push(Schema.intersect([
          Schema.object({
            protocol: Schema.const(protocol).required(),
          }),
          args[0][protocol].schema,
        ]).description(protocol))
      }
      BotConfig.list.push(Schema.transform(FlatConfig, (value) => {
        if (value.protocol) throw new Error(`unknown protocol "${value.protocol}"`)
        value.protocol = args[1](value) as never
        logger.debug('infer type as %s', value.protocol)
        return value
      }))
    }

    const Config = Schema.intersect([
      constructor.schema,
      Schema.union([
        Schema.object({ bots: Schema.array(BotConfig).required().hidden() }),
        Schema.transform(BotConfig, config => ({ bots: [config] })),
      ]),
    ])

    function apply(ctx: Context, config: PluginConfig = {}) {
      ctx.emit('adapter', platform)
      configMap[platform] = config

      for (const options of config.bots) {
        ctx.bots.create(platform, options, constructor)
      }
    }

    return { name, Config, apply }
  }

  export class BotList extends Array<Bot> {
    adapters: Dict<Adapter> = {}

    constructor(private app: App) {
      super()
    }

    get(sid: string) {
      return this.find(bot => bot.sid === sid)
    }

    create<T extends Bot>(platform: string, options: any, constructor?: new (adapter: Adapter, config: any) => T): T {
      constructor ||= Bot.library[platform] as any
      const adapter = this.resolve(platform, options)
      const bot = new constructor(adapter, options)
      adapter.bots.push(bot)
      this.push(bot)
      this.app.emit('bot-added', bot)
      return bot
    }

    async remove(id: string) {
      const index = this.findIndex(bot => bot.id === id)
      if (index < 0) return
      const [bot] = this.splice(index, 1)
      remove(bot.adapter.bots, bot)
      bot.config.disabled = true
      this.app.emit('bot-removed', bot)
      return bot.stop()
    }

    private resolve(platform: string, config: Bot.BaseConfig): Adapter {
      const type = join(platform, config.protocol)
      if (this.adapters[type]) return this.adapters[type]

      const constructor = Adapter.library[type]
      if (!constructor) {
        throw new Error(`unsupported protocol "${type}"`)
      }

      if (constructor[redirect]) {
        config.protocol = constructor[redirect](config)
        return this.resolve(platform, config)
      }

      const adapter = new constructor(this[Context.current], configMap[platform])
      adapter.platform = platform
      return this.adapters[type] = adapter
    }
  }
}
