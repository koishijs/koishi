/* eslint-disable no-irregular-whitespace */

import { Argv, Context, Session } from 'koishi-core'
import { escapeRegExp, merge } from 'koishi-utils'
import { Dialogue } from './utils'
import internal from './internal'
import receiver from './receiver'
import search from './search'
import update, { create } from './update'
import mongo from './database/mongo'
import mysql from './database/mysql'
import context from './plugins/context'
import image from './plugins/image'
import throttle from './plugins/throttle'
import probability from './plugins/probability'
import successor from './plugins/successor'
import time from './plugins/time'
import writer from './plugins/writer'

export * from './utils'
export * from './receiver'
export * from './search'
export * from './update'
export * from './plugins/context'
export * from './plugins/image'
export * from './plugins/throttle'
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

const cheatSheet = (session: Session<'authority'>, config: Config) => {
  const { authority } = session.user
  const { authority: a, prefix: p } = config
  return `\
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
　禁用递归查询：　-R${authority >= a.regExp ? `
　正则+合并结果：${p}${p}${p}` : ''}${config.useContext ? `
上下文选项：
　允许本群：　　　-e
　禁止本群：　　　-d` : ''}${config.useContext && authority >= a.context ? `
　全局允许：　　　-E
　全局禁止：　　　-D
　设置群号：　　　-g id
　无视上下文搜索：-G` : ''}
问答选项：${config.useWriter && authority >= a.frozen ? `
　锁定问答：　　　-f/-F
　教学者代行：　　-s/-S` : ''}${config.useWriter && authority >= a.writer ? `
　设置问题作者：　-w uid
　设置为匿名：　　-W` : ''}
　忽略智能提示：　-I
　重定向：　　　　=>
匹配规则：${authority >= a.regExp ? `
　正则表达式：　　-x/-X` : ''}
　严格匹配权重：　-p prob
　称呼匹配权重：　-P prob${config.useTime ? `
　设置起始时间：　-t time
　设置结束时间：　-T time` : ''}
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
　$$：一个普通的 $ 字符
　$0：收到的原文本
　$n：分条发送
　$a：@说话人
　$m：@${session.app.options.nickname[0]}
　$s：说话人的名字
　\$()：指令插值
　\${}：表达式插值`
}

export const name = 'teach'

function registerPrefix(ctx: Context, prefix: string) {
  const g = '\\d+(?:\\.\\.\\d+)?'
  const p = escapeRegExp(prefix)
  const teachRegExp = new RegExp(`^${p}(${p}?)((${g}(?:,${g})*)?|${p}?)$`)
  //                                   $1     $2

  ctx.on('parse', (argv, session) => {
    if (argv.root && (session.parsed.prefix || session.reply)) return
    const capture = teachRegExp.exec(argv.tokens[0]?.content)
    if (!capture) return

    argv.tokens.shift()
    argv.tokens.forEach(Argv.revert)
    argv.source = session.parsed.content
    argv.options = {}
    const { length } = argv.tokens
    if (capture[1] === prefix) {
      if (!argv.tokens.length) {
        return 'teach.status'
      }
      argv.options['search'] = true
      if (capture[2] === prefix) {
        argv.options['autoMerge'] = true
        argv.options['regexp'] = true
      }
    } else if (!capture[2] && !length) {
      argv.options['help'] = true
    }

    if (capture[2] && capture[2] !== prefix) {
      argv.options['target'] = capture[2]
    }

    return 'teach'
  })
}

export function apply(ctx: Context, config: Config = {}) {
  config = merge(config, {
    prefix: '#',
    authority: {
      base: 2,
      admin: 3,
      context: 3,
      frozen: 4,
      regExp: 3,
      writer: 2,
    },
  })

  registerPrefix(ctx, config.prefix)

  ctx.command('teach', '添加教学对话', { authority: config.authority.base, checkUnknown: true, hideOptions: true })
    .userFields(['authority', 'id'])
    .usage(session => cheatSheet(session, config))
    .action(async (argv) => {
      const { options, session, args } = argv
      const argd: Dialogue.Argv = { app: ctx.app, session, args, config, options }
      return ctx.bail('dialogue/validate', argd)
        || ctx.bail('dialogue/execute', argd)
        || create(argd)
    })

  // features
  ctx.plugin(receiver, config)
  ctx.plugin(search, config)
  ctx.plugin(update, config)
  ctx.plugin(mongo, config)
  ctx.plugin(mysql, config)

  // options
  ctx.plugin(internal, config)
  ctx.plugin(context, config)
  ctx.plugin(image, config)
  ctx.plugin(throttle, config)
  ctx.plugin(probability, config)
  ctx.plugin(successor, config)
  ctx.plugin(time, config)
  ctx.plugin(writer, config)
}
