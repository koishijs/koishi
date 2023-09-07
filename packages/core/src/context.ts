import { defineProperty, Time } from 'cosmokit'
import { Context, Schema } from '@satorijs/core'
import * as cordis from 'cordis'
import { Computed } from './filter'
import { Commander } from './command'
import { I18n } from './i18n'

export type Plugin = cordis.Plugin<Context>

export namespace Plugin {
  export type Function<T = any> = cordis.Plugin.Function<T, Context>
  export type Constructor<T = any> = cordis.Plugin.Constructor<T, Context>
  export type Object<S = any, T = any> = cordis.Plugin.Object<S, T, Context>
}

export type EffectScope = cordis.EffectScope<Context>
export type ForkScope = cordis.ForkScope<Context>
export type MainScope = cordis.MainScope<Context>
export type Service = cordis.Service<Context>

export const Service = cordis.Service<Context>

export { resolveConfig } from 'cordis'

export type { Disposable, ScopeStatus } from 'cordis'

declare module 'cordis' {
  namespace Plugin {
    interface Object {
      filter?: boolean
    }
  }
}

declare module '@satorijs/core' {
  export interface Context {
    envData: EnvData
    baseDir: string
  }

  export namespace Context {
    export interface Config extends Config.Basic, Config.Advanced {
      i18n?: I18n.Config
      delay?: Config.Delay
    }

    export namespace Config {
      export interface Basic extends Commander.Config {
        nickname?: string | string[]
        autoAssign?: Computed<boolean>
        autoAuthorize?: Computed<number>
        minSimilarity?: number
      }

      export interface Delay {
        character?: number
        message?: number
        cancel?: number
        broadcast?: number
        prompt?: number
      }

      export interface Advanced {
        maxListeners?: number
      }

      export interface Static extends Schema<Config> {
        Basic: Schema<Basic>
        I18n: Schema<I18n>
        Delay: Schema<Delay>
        Advanced: Schema<Advanced>
      }
    }
  }
}

export interface EnvData {}

defineProperty(Context.Config, 'Basic', Schema.object({
  prefix: Schema.union([
    Schema.array(Schema.string().default('')).role('table'),
    Schema.transform(String, (prefix) => [prefix]),
    Schema.any().hidden(),
  ]).role('computed').default(['']).description('指令前缀字符构成的数组。将被用于指令的匹配。'),
  nickname: Schema.union([
    Schema.array(String).role('table'),
    Schema.transform(String, (nickname) => [nickname]),
  ] as const).description('机器人昵称构成的数组。将被用于指令的匹配。'),
  autoAssign: Schema.union([
    Schema.boolean(),
    Schema.any().hidden(),
  ]).role('computed').default(true).description('当获取不到频道数据时，是否使用接受者作为受理人。'),
  autoAuthorize: Schema.union([
    Schema.natural(),
    Schema.any().hidden(),
  ]).role('computed').default(1).description('当获取不到用户数据时默认使用的权限等级。'),
  minSimilarity: Schema.percent().default(1).description('用于模糊匹配的相似系数，应该是一个 0 到 1 之间的数值。数值越高，模糊匹配越严格。设置为 1 可以完全禁用模糊匹配。'),
}).description('基础设置'))

defineProperty(Context.Config, 'I18n', I18n.Config)

defineProperty(Context.Config, 'Delay', Schema.object({
  character: Schema.natural().role('ms').default(0).description('调用 `session.sendQueued()` 时消息间发送的最小延迟，按前一条消息的字数计算。'),
  message: Schema.natural().role('ms').default(0.1 * Time.second).description('调用 `session.sendQueued()` 时消息间发送的最小延迟，按固定值计算。'),
  cancel: Schema.natural().role('ms').default(0).description('调用 `session.cancelQueued()` 时默认的延迟。'),
  broadcast: Schema.natural().role('ms').default(0.5 * Time.second).description('调用 `bot.broadcast()` 时默认的延迟。'),
  prompt: Schema.natural().role('ms').default(Time.minute).description('调用 `session.prompt()` 时默认的等待时间。'),
}))

defineProperty(Context.Config, 'Advanced', Schema.object({
  maxListeners: Schema.natural().default(64).description('每种监听器的最大数量。如果超过这个数量，Koishi 会认定为发生了内存泄漏，将产生一个警告。'),
}).description('高级设置'))

Context.Config.list.push(Context.Config.Basic)
Context.Config.list.push(Schema.object({
  i18n: I18n.Config,
}))
Context.Config.list.push(Schema.object({
  delay: Context.Config.Delay,
}).description('延迟设置'))
Context.Config.list.push(Context.Config.Advanced)

// for backward compatibility
export { Context as App }

export function defineConfig(config: Context.Config) {
  return config
}
