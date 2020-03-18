import { Context, removeBrackets, ParsedCommandLine } from 'koishi-core'
import { TeachConfig } from './utils'

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
　设置搜索结果页码：-P
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
特殊语法：
　$$：一个普通的 $ 字符
　$0：收到的原文本
　$n：分条发送
　$a：@说话人
　$m：@四季酱
　$s：说话人的名字`

export default function (ctx: Context, config: TeachConfig) {
  ctx.command('teach').usage('输入 # 查看教学系统用法示例。')

  ctx.prependMiddleware((meta, next) => {
    const capture = meta.message.match(/^#(#{0,2}|\d+(,\d+)*)(\s+|$)/)
    if (!capture) return next()
    const command = ctx.getCommand('teach', meta)
    const message = meta.message.slice(capture[0].length)
    const { options, args, unknown } = command.parse(message)
    const argv: ParsedCommandLine = { options, args, unknown, meta, command }

    if (capture[1].startsWith('#')) {
      options.search = true
      if (capture[1].length > 1) {
        options.keyword = true
        options.autoMerge = true
      }
      if (!args.length) {
        options.info = true
      }
    } else if (capture[1]) {
      options.target = capture[1]
    } else if (!message) {
      return meta.$send(cheetSheet)
    }

    function attachOption (keyword: string, key: string) {
      const option = command._optsDef[key]
      const fullname = removeBrackets(option.rawName)
      const index = args.indexOf(keyword)
      if (index >= 0) {
        const [_, value] = args.splice(index, 2)
        if (!value) return meta.$send(`选项 ${fullname} 缺少参数。`)
        for (const name of option.camels) {
          options[name] = value
        }
      }
    }

    if (attachOption('<<', 'set-pred')) return
    if (attachOption('<', 'add-pred')) return
    if (attachOption('>>', 'set-succ')) return
    if (attachOption('>', 'add-succ')) return

    function parseArgument () {
      if (!args.length) return
      const [arg] = args.splice(0, 1)
      if (!arg || arg === '~') return
      return arg
    }

    options.question = parseArgument()
    options.answer = parseArgument()

    Object.defineProperty(meta, '$argv', {
      writable: true,
      value: argv,
    })

    return next()
  })
}
