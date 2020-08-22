/* eslint-disable no-irregular-whitespace */

import { Context, ExecuteArgv } from 'koishi-core'
import { escapeRegExp } from 'koishi-utils'
import { Dialogue, parseTeachArgs } from './utils'
import internal from './internal'
import receiver from './receiver'
import search from './search'
import update, { create } from './update'
import context from './plugins/context'
import image from './plugins/image'
import throttle from './plugins/throttle'
import preventLoop from './plugins/preventLoop'
import probability from './plugins/probability'
import successor from './plugins/successor'
import time from './plugins/time'
import writer from './plugins/writer'
import database from './database'

export * from './database'
export * from './utils'
export * from './receiver'
export * from './search'
export * from './update'
export * from './plugins/context'
export * from './plugins/image'
export * from './plugins/throttle'
export * from './plugins/preventLoop'
export * from './plugins/probability'
export * from './plugins/successor'
export * from './plugins/time'
export * from './plugins/writer'

export type Config = Dialogue.Config

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/validate'(argv: Dialogue.Argv): void | string
    'dialogue/execute'(argv: Dialogue.Argv): void | Promise<void | string>
  }
}

const cheatSheet = (p: string, authority: number) => `\
教学系统基本用法：
　添加问答：${p} 问题 回答
　搜索回答：${p}${p} 问题
　搜索问题：${p}${p} ~ 回答
　查看问答：${p}id
　修改问题：${p}id 问题
　修改回答：${p}id ~ 回答
　删除问答：${p}id -r
　批量查看：${p}${p}id
搜索选项：
　管道语法：　　　|
　结果页码：　　　/ page
　禁用递归查询：　-R${authority >= 3 ? `
　正则+合并结果：${p}${p}${p}` : ''}
上下文选项：
　允许本群：　　　-e
　禁止本群：　　　-d${authority >= 3 ? `
　全局允许：　　　-E
　全局禁止：　　　-D
　设置群号：　　　-g id
　无视上下文搜索：-G` : ''}
问答选项：${authority >= 3 ? `
　锁定问答：　　　-f/-F
　教学者代行：　　-s/-S` : ''}
　设置问题作者：　-w uid
　设置为匿名：　　-W
　忽略智能提示：　-i
　重定向：　　　　=>
匹配规则：${authority >= 3 ? `
　正则表达式：　　-x/-X` : ''}
　严格匹配权重：　-p prob
　称呼匹配权重：　-P prob
　设置最小好感度：-a aff
　设置最大好感度：-A aff
　设置起始时间：　-t time
　设置结束时间：　-T time
前置与后继：
　设置前置问题：　< id
　添加前置问题：　<< id
　设置后继问题：　> id
　添加后继问题：　>> id
　上下文触发后继：-c/-C
　前置生效时间：　-z secs
　创建新问答并作为后继：>#
回退功能：
　查看近期改动：　-v
　回退近期改动：　-V
　设置查看区间：　-l/-L
特殊语法：
　%%：一个普通的 % 字符
　%0：收到的原文本
　%n：分条发送
　%a：@说话人
　%m：@四季酱
　%s：说话人的名字
　%{}: 指令插值`

export const name = 'teach'

function registerPrefix(ctx: Context, prefix: string) {
  const g = '\\d+(?:\\.\\.\\d+)?'
  const p = escapeRegExp(prefix)
  const teachRegExp = new RegExp(`^${p}(${p}?)((${g}(?:,${g})*)?|${p}?)(\\s+|$)`)
  //                                   $1     $2

  ctx.on('parse', (source, session, builtin) => {
    if (builtin && session.$prefix) return
    const capture = source.match(teachRegExp)
    if (!capture) return

    const command = ctx.command('teach')
    const message = source.slice(capture[0].length)
    const { options, args, rest } = command.parse(message)
    const argv: ExecuteArgv = { options, args, command, source, rest }

    if (capture[1] === prefix) {
      options['search'] = true
      if (capture[2] === prefix) {
        options['autoMerge'] = true
        options['regexp'] = true
      }
    } else if (!capture[2] && !message) {
      options['help'] = true
    }

    if (capture[2] && capture[2] !== prefix) {
      options['target'] = capture[2]
    }

    parseTeachArgs(argv)
    return argv
  })
}

const defaultConfig: Config = {
  prefix: '#',
}

export function apply(ctx: Context, config: Dialogue.Config = {}) {
  config = { ...defaultConfig, ...config }
  registerPrefix(ctx, config.prefix)

  ctx.command('teach', '添加教学对话', { authority: 2, checkUnknown: true, hideOptions: true })
    .userFields(['authority', 'id'])
    .usage(({ $user }) => cheatSheet(config.prefix, $user.authority))
    .action(async ({ options, session, args }) => {
      const argv: Dialogue.Argv = { ctx, session, args, config, options }
      return ctx.bail('dialogue/validate', argv)
        || ctx.bail('dialogue/execute', argv)
        || create(argv)
    })

  // features
  ctx.plugin(database, config)
  ctx.plugin(receiver, config)
  ctx.plugin(search, config)
  ctx.plugin(update, config)

  // options
  ctx.plugin(internal, config)
  ctx.plugin(context, config)
  ctx.plugin(image, config)
  ctx.plugin(throttle, config)
  ctx.plugin(preventLoop, config)
  ctx.plugin(probability, config)
  ctx.plugin(successor, config)
  ctx.plugin(time, config)
  ctx.plugin(writer, config)
}
