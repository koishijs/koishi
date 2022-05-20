import { defineProperty, Schema, Time } from '@koishijs/utils'
import { Awaitable } from 'cosmokit'
import { App } from 'cordis'
import { Computed, SuggestConfig } from './protocol'
import { Commander } from './command'

export * from '@koishijs/utils'
export * from 'minato'
export * from './command'
export * from './database'
export * from './i18n'
export * from './protocol'

export { App, Context, Disposable, Events, Filter, Plugin } from 'cordis'

const version: string = require('../package.json').version
export { version }

/** @deprecated for backward compatibility */
export interface EventMap {}

declare module 'cordis' {
  interface Events extends EventMap {}

  namespace App {
    export interface Config extends Config.Basic, Config.Features, Config.Advanced {}

    export const Config: Config.Static

    export namespace Config {
      export interface Basic extends SuggestConfig {
        locale?: string
        prefix?: Computed<string | string[]>
        nickname?: string | string[]
        autoAssign?: Computed<Awaitable<boolean>>
        autoAuthorize?: Computed<Awaitable<number>>
      }

      export interface Features extends Commander.Config {
        delay?: DelayConfig
      }

      export interface Advanced {
        maxListeners?: number
        prettyErrors?: boolean
      }

      export interface Static extends Schema<Config> {
        Basic: Schema<Basic>
        Features: Schema<Features>
        Advanced: Schema<Advanced>
      }
    }
  }
}

export interface DelayConfig {
  character?: number
  message?: number
  cancel?: number
  broadcast?: number
  prompt?: number
}

export interface AppConfig extends App.Config.Basic, App.Config.Features, App.Config.Advanced {}

defineProperty(App, 'Config', Schema.intersect([]))

defineProperty(App.Config, 'Basic', Schema.object({
  locale: Schema.string().default('zh').description('默认使用的语言。'),
  prefix: Schema.union([
    Schema.array(String),
    Schema.transform(String, (prefix) => [prefix]),
  ] as const).default(['']).description('指令前缀字符，可以是字符串或字符串数组。将用于指令前缀的匹配。'),
  nickname: Schema.union([
    Schema.array(String),
    Schema.transform(String, (nickname) => [nickname]),
  ] as const).description('机器人的昵称，可以是字符串或字符串数组。将用于指令前缀的匹配。'),
  autoAssign: Schema.union([Boolean, Function]).default(true).description('当获取不到频道数据时，是否使用接受者作为代理者。'),
  autoAuthorize: Schema.union([Schema.natural(), Function]).default(1).description('当获取不到用户数据时默认使用的权限等级。'),
  minSimilarity: Schema.percent().default(0.4).description('用于模糊匹配的相似系数，应该是一个 0 到 1 之间的数值。数值越高，模糊匹配越严格。设置为 1 可以完全禁用模糊匹配。'),
}).description('基础设置'))

defineProperty(App.Config, 'Features', Schema.object({
  delay: Schema.object({
    character: Schema.natural().role('ms').default(0).description('调用 `session.sendQueued()` 时消息间发送的最小延迟，按前一条消息的字数计算。'),
    message: Schema.natural().role('ms').default(0.1 * Time.second).description('调用 `session.sendQueued()` 时消息间发送的最小延迟，按固定值计算。'),
    cancel: Schema.natural().role('ms').default(0).description('调用 `session.cancelQueued()` 时默认的延迟。'),
    broadcast: Schema.natural().role('ms').default(0.5 * Time.second).description('调用 `bot.broadcast()` 时默认的延迟。'),
    prompt: Schema.natural().role('ms').default(Time.minute).description('调用 `session.prompt()` 时默认的等待时间。'),
  }),
}).description('消息设置'))

defineProperty(App.Config, 'Advanced', Schema.object({
  prettyErrors: Schema.boolean().default(true).description('启用报错优化模式。在此模式下 Koishi 会对程序抛出的异常进行整理，过滤掉框架内部的调用记录，输出更易读的提示信息。'),
  maxListeners: Schema.natural().default(64).description('每种监听器的最大数量。如果超过这个数量，Koishi 会认定为发生了内存泄漏，将产生一个警告。'),
}).description('高级设置'))

App.Config.list.push(App.Config.Basic, App.Config.Features, App.Config.Advanced)

export function defineConfig(config: App.Config) {
  return config
}
