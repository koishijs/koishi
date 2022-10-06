import { Awaitable, defineProperty, Schema, Time } from '@koishijs/utils'
import * as satori from '@satorijs/core'
import * as cordis from 'cordis'
import { Computed, Session } from './session'

export type Plugin = cordis.Plugin<Context>

export namespace Plugin {
  export type Function<T = any> = cordis.Plugin.Function<T, Context>
  export type Constructor<T = any> = cordis.Plugin.Constructor<T, Context>
  export type Object<S = any, T = any> = cordis.Plugin.Object<S, T, Context>
}

export type State = cordis.State<Context>
export type Fork = cordis.Fork<Context>
export type Runtime = cordis.Runtime<Context>

export const Service = cordis.Service<Context>

export { resolveConfig } from 'cordis'

export type { Disposable } from 'cordis'

export interface Events<C extends Context = Context> extends satori.Events<C> {
  'appellation'(name: string, session: Session): string
}

export interface Context {
  [Context.events]: Events<this>
  [Context.session]: Session
  [Context.config]: Context.Config
}

export class Context extends satori.Context {
  constructor(options?: Context.Config) {
    super(options)
  }

  get app() {
    return this.root
  }

  /** @deprecated use `root.config` instead */
  get options() {
    return this.root.config
  }
}

export namespace Context {
  export interface Config extends satori.Context.Config, Config.Basic, Config.Message, Config.Advanced {}

  export namespace Config {
    export interface Basic {
      locale?: string
      prefix?: Computed<string | string[]>
      nickname?: string | string[]
      autoAssign?: Computed<Awaitable<boolean>>
      autoAuthorize?: Computed<Awaitable<number>>
    }

    export interface Message {
      delay?: DelayConfig
    }

    export interface DelayConfig {
      character?: number
      message?: number
      cancel?: number
      broadcast?: number
      prompt?: number
    }

    export interface Advanced {
      maxListeners?: number
      prettyErrors?: boolean
    }

    export interface Static extends Schema<Config> {
      Basic: Schema<Basic>
      Message: Schema<Message>
      Advanced: Schema<Advanced>
    }
  }

  export const Config = Schema.intersect([]) as Config.Static

  defineProperty(Context.Config, 'Basic', Schema.object({
    locale: Schema.string().default('zh').description('默认使用的语言。'),
    prefix: Schema.union([
      Schema.array(String),
      Schema.transform(String, (prefix) => [prefix]),
      Schema.function(),
    ] as const).default(['']).description('指令前缀字符构成的数组。将被用于指令的匹配。'),
    nickname: Schema.union([
      Schema.array(String),
      Schema.transform(String, (nickname) => [nickname]),
    ] as const).description('机器人昵称构成的数组。将被用于指令的匹配。'),
    autoAssign: Schema.union([Boolean, Function]).default(true).description('当获取不到频道数据时，是否使用接受者作为代理者。'),
    autoAuthorize: Schema.union([Schema.natural(), Function]).default(1).description('当获取不到用户数据时默认使用的权限等级。'),
  }).description('基础设置'))

  defineProperty(Context.Config, 'Message', Schema.object({
    delay: Schema.object({
      character: Schema.natural().role('ms').default(0).description('调用 `session.sendQueued()` 时消息间发送的最小延迟，按前一条消息的字数计算。'),
      message: Schema.natural().role('ms').default(0.1 * Time.second).description('调用 `session.sendQueued()` 时消息间发送的最小延迟，按固定值计算。'),
      cancel: Schema.natural().role('ms').default(0).description('调用 `session.cancelQueued()` 时默认的延迟。'),
      broadcast: Schema.natural().role('ms').default(0.5 * Time.second).description('调用 `bot.broadcast()` 时默认的延迟。'),
      prompt: Schema.natural().role('ms').default(Time.minute).description('调用 `session.prompt()` 时默认的等待时间。'),
    }),
  }).description('消息设置'))

  defineProperty(Context.Config, 'Advanced', Schema.object({
    prettyErrors: Schema.boolean().default(true).description('启用报错优化模式。在此模式下 Koishi 会对程序抛出的异常进行整理，过滤掉框架内部的调用记录，输出更易读的提示信息。'),
    maxListeners: Schema.natural().default(64).description('每种监听器的最大数量。如果超过这个数量，Koishi 会认定为发生了内存泄漏，将产生一个警告。'),
  }).description('高级设置'))

  Context.Config.list.push(Context.Config.Basic, Context.Config.Message, Context.Config.Advanced)
}

// for backward compatibility
export { Context as App }

export function defineConfig(config: Context.Config) {
  return config
}
