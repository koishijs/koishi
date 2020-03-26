import { Context } from 'koishi-core'
import { TeachConfig, TeachArgv } from './utils'
import internal from './internal'
import receiver from './receiver'
import search from './search'
import shortcut from './shortcut'
import teach from './teach'
import update from './update'
import context from './plugins/context'
import freeze from './plugins/freeze'
import throttle from './plugins/throttle'
import preventLoop from './plugins/preventLoop'
import successor from './plugins/successor'
import writer from './plugins/writer'

export * from './database'
export * from './receiver'
export * from './search'
export * from './shortcut'
export * from './utils'
export * from './plugins/context'
export * from './plugins/freeze'
export * from './plugins/throttle'
export * from './plugins/preventLoop'
export * from './plugins/successor'
export * from './plugins/writer'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/validate' (argv: TeachArgv): any
    'dialogue/execute' (argv: TeachArgv): any
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
　删除问答：#id -r
搜索选项：
　使用关键词搜索：　-k
　设置搜索结果页码：##p, ###p
　关键词搜索，自动合并搜索结果：###
上下文选项：
　允许本群：　　　-e
　全局允许：　　　-E
　禁止本群：　　　-d
　全局禁止：　　　-D
　无视上下文搜索：-G
问答选项：
　设置前置问题：　<< id
　添加前置问题：　< id
　设置后继问题：　>> id
　添加后继问题：　> id
　设置触发权重：　-p prob
　设置问题作者：　-w uid
　设置为匿名：　　-W
　设置最小好感度：-m aff
　设置最大好感度：-M aff
重定向：
　重定向到问题：# 问题 => 问题
　重定向为指令调用：# 问题 -c 指令
　取消重定向：-C
特殊语法：
　$$：一个普通的 $ 字符
　$0：收到的原文本
　$n：分条发送
　$a：@说话人
　$m：@四季酱
　$s：说话人的名字`

export const name = 'teach'

export function apply (ctx: Context, config: TeachConfig = {}) {
  ctx.command('teach', '添加教学对话', { authority: 2, checkUnknown: true, hideOptions: true })
    .usage(cheetSheet)
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
  ctx.plugin(context, config)
  ctx.plugin(freeze, config)
  ctx.plugin(throttle, config)
  ctx.plugin(preventLoop, config)
  ctx.plugin(successor, config)
  ctx.plugin(writer, config)
}
