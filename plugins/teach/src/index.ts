/* eslint-disable no-irregular-whitespace */

import { Awaitable, Context, Schema, Time } from 'koishi'
import { Dialogue } from './utils'

// features
import command from './command'
import frontend from './frontend'
import receiver from './receiver'
import search from './search'
import service from './service'
import update from './update'

// options
import context from './plugins/context'
import internal from './plugins/internal'
import probability from './plugins/probability'
import successor from './plugins/successor'
import throttle from './plugins/throttle'
import time from './plugins/time'
import writer from './plugins/writer'

export * from './utils'
export * from './receiver'
export * from './search'
export * from './update'
export * from './plugins/context'
export * from './plugins/throttle'
export * from './plugins/probability'
export * from './plugins/successor'
export * from './plugins/time'
export * from './plugins/writer'

declare module 'koishi' {
  interface EventMap {
    'dialogue/validate'(argv: Dialogue.Argv): void | string
    'dialogue/execute'(argv: Dialogue.Argv): Awaitable<void | string>
  }

  interface Modules {
    teach: typeof import('.')
  }
}

export type Config = Dialogue.Config

export const schema: Schema<Config> = Schema.intersect([
  Schema.object({
    prefix: Schema.string().description('教学指令的前缀。').default('#'),
    historyTimeout: Schema.number().description('教学操作在内存中的保存时间。').default(Time.minute * 10),
  }).description('通用设置'),

  Schema.object({
    authority: Schema.object({
      base: Schema.number().description('可访问教学系统的权限等级。').default(2),
      admin: Schema.number().description('可修改非自己创建的问答的权限等级。').default(3),
      context: Schema.number().description('可修改上下文设置的权限等级。').default(3),
      frozen: Schema.number().description('可修改锁定的问答的权限等级。').default(4),
      regExp: Schema.number().description('可使用正则表达式的权限等级。').default(3),
      writer: Schema.number().description('可设置作者或匿名的权限等级。').default(2),
    }),
  }).description('权限设置'),

  Schema.object({
    maxRedirections: Schema.number().description('问题重定向的次数上限。').default(3),
    successorTimeout: Schema.number().description('问答触发后继问答的持续时间。').default(Time.second * 20),
    appellationTimeout: Schema.number().description('称呼作为问题触发的后续效果持续时间。').default(Time.minute * 10),
  }).description('触发设置'),

  Schema.object({
    maxPreviews: Schema.number().description('同时查看的最大问答数量。').default(10),
    previewDelay: Schema.number().description('显示两个问答之间的时间间隔。').default(Time.second * 0.5),
    itemsPerPage: Schema.number().description('搜索结果每一页显示的最大数量。').default(30),
    maxAnswerLength: Schema.number().description('搜索结果中回答显示的长度限制。').default(100),
    mergeThreshold: Schema.number().description('合并搜索模式中，相同的问题和回答被合并的最小数量。').default(5),
  }).description('显示设置'),
])

export const name = 'teach'
export const using = ['database'] as const

export function apply(ctx: Context, config: Config) {
  // features
  ctx.plugin(service, config)
  ctx.plugin(command, config)
  ctx.plugin(receiver, config)
  ctx.plugin(search, config)
  ctx.plugin(update, config)
  ctx.plugin(frontend, config)

  // options
  ctx.plugin(context, config)
  ctx.plugin(internal, config)
  ctx.plugin(probability, config)
  ctx.plugin(successor, config)
  ctx.plugin(throttle, config)
  ctx.plugin(time, config)
  ctx.plugin(writer, config)
}
