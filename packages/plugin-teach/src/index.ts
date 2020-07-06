import { Context } from 'koishi-core'
import { TeachConfig, TeachArgv } from './utils'
import internal from './internal'
import receiver from './receiver'
import search from './search'
import shortcut from './shortcut'
import teach from './teach'
import update from './update'
import affinity from './plugins/affinity'
import context from './plugins/context'
import freeze from './plugins/freeze'
import throttle from './plugins/throttle'
import preventLoop from './plugins/preventLoop'
import probability from './plugins/probability'
import successor from './plugins/successor'
import time from './plugins/time'
import writer from './plugins/writer'

export * from './database'
export * from './receiver'
export * from './search'
export * from './shortcut'
export * from './utils'
export * from './plugins/affinity'
export * from './plugins/context'
export * from './plugins/freeze'
export * from './plugins/throttle'
export * from './plugins/preventLoop'
export * from './plugins/probability'
export * from './plugins/successor'
export * from './plugins/time'
export * from './plugins/writer'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/validate' (argv: TeachArgv): void | Promise<void>
    'dialogue/execute' (argv: TeachArgv): void | Promise<void>
  }
}

const cheetSheet = `\
教学系统基本用法：
　添加问答：# 问题 回答
　查询回答：## 问题
　查询问题：## ~ 回答
　查看问答：#id
　修改问题：#id 问题
　修改回答：#id ~ 回答
　删除问答：#id --remove
搜索选项：
　管道语法：　|
　设置搜索结果页码：##p, ###p
　正则搜索，自动合并搜索结果：###
上下文选项：
　允许本群：　　　-e
　全局允许：　　　-E
　禁止本群：　　　-d
　全局禁止：　　　-D
　设置群号：　　　-g id
　无视上下文搜索：-G
问答选项：
　正则表达式：　　-x/-X
　锁定问答：　　　-f/-F
　任意人触发后继：-i/-I
　教学者代行：　　-s/-S
　设置前置问题：　< id
　添加前置问题：　<< id
　设置后继问题：　> id
　添加后继问题：　>> id
　创建新问答并作为后继：>#
　严格匹配权重：　-p probS
　称呼匹配权重：　-P probA
　设置问题作者：　-w uid
　设置为匿名：　　-W
　设置最小好感度：-a aff
　设置最大好感度：-A aff
　设置起始时间：　-t time
　设置结束时间：　-T time
  重定向：　　=> question
特殊语法：
　$$：一个普通的 $ 字符
　$0：收到的原文本
　$n：分条发送
　$a：@说话人
　$m：@四季酱
　$s：说话人的名字
　\${}: 指令插值`

export const name = 'teach'

export function apply (ctx: Context, config: TeachConfig = {}) {
  ctx.command('teach', '添加教学对话', { authority: 2, checkUnknown: true, hideOptions: true })
    .usage(cheetSheet)
    .userFields(['authority', 'id'])
    .action(async ({ options, meta, args }) => {
      const argv: TeachArgv = { ctx, meta, args, config, options }
      return ctx.bail('dialogue/validate', argv)
        || ctx.bail('dialogue/execute', argv)
    })

  // features
  ctx.plugin(shortcut, config)
  ctx.plugin(receiver, config)
  ctx.plugin(search, config)
  ctx.plugin(update, config)
  ctx.plugin(teach, config)

  // options
  ctx.plugin(internal, config)
  ctx.plugin(affinity, config)
  ctx.plugin(context, config)
  ctx.plugin(freeze, config)
  ctx.plugin(throttle, config)
  ctx.plugin(preventLoop, config)
  ctx.plugin(probability, config)
  ctx.plugin(successor, config)
  ctx.plugin(time, config)
  ctx.plugin(writer, config)
}
