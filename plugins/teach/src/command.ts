/* eslint-disable no-irregular-whitespace */

import { Argv, Context, escapeRegExp, Session } from 'koishi'
import { create } from './update'
import { Dialogue } from './utils'
import {} from '@koishijs/plugin-console'
import {} from '@koishijs/plugin-status'

declare module './utils' {
  export namespace Dialogue {
    export interface Config {
      prefix?: string
      authority?: AuthorityConfig
    }
  }
}

export interface AuthorityConfig {
  /** 可访问教学系统，默认值为 2 */
  base?: number
  /** 可修改非自己创建的问答，默认值为 3 */
  admin?: number
  /** 可修改上下文设置，默认值为 3 */
  context?: number
  /** 可修改锁定的问答，默认值为 4 */
  frozen?: number
  /** 可使用正则表达式，默认值为 3 */
  regExp?: number
  /** 可设置作者或匿名，默认值为 2 */
  writer?: number
  /** 可触发教学问答，默认值为 1 */
  receive?: number
}

const cheatSheet = (session: Session<'authority'>, config: Dialogue.Config) => {
  const { authority } = session.user
  const { authority: a, prefix: p } = config
  const l = p[p.length - 1]
  return `\
教学系统基本用法：
　添加问答：${p} 问题 回答
　搜索回答：${p}${l} 问题
　搜索问题：${p}${l} ~ 回答
　查看问答：${p}id
　修改问题：${p}id 问题
　修改回答：${p}id ~ 回答
　删除问答：${p}id -r
　批量查看：${p}${l}id
搜索选项：
　管道语法：　　　|
　结果页码：　　　/ page
　禁用递归查询：　-R${authority >= a.regExp ? `
　正则+合并结果：${p}${l}${l}` : ''}${config.useContext ? `
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

function registerPrefix(ctx: Context, prefix: string) {
  const g = '\\d+(?:\\.\\.\\d+)?'
  const last = prefix[prefix.length - 1]
  const p = escapeRegExp(prefix)
  const l = escapeRegExp(last)
  const teachRegExp = new RegExp(`^${p}(${l}?)((${g}(?:,${g})*)?|${l}?)$`)
  //                                   $1     $2

  ctx.before('parse', (content, session) => {
    const argv = Argv.parse(content)
    if (session.quote || !argv.tokens.length) return
    let prefix = argv.tokens[0].content
    if (session.parsed.prefix) {
      prefix = session.parsed.prefix + prefix
    }
    const capture = teachRegExp.exec(prefix)
    if (!capture) return

    argv.tokens.shift()
    argv.tokens.forEach(Argv.revert)
    argv.source = session.parsed.content
    argv.options = {}
    const { length } = argv.tokens
    if (capture[1] === last) {
      if (!argv.tokens.length) {
        argv.name = 'teach.status'
        return argv
      }
      argv.options['search'] = true
      if (capture[2] === last) {
        argv.options['autoMerge'] = true
        argv.options['regexp'] = true
      }
    } else if (!capture[2] && !length) {
      argv.options['help'] = true
    }

    if (capture[2] && capture[2] !== last) {
      argv.options['target'] = capture[2]
    }

    argv.name = 'teach'
    return argv
  })
}

export default function command(ctx: Context, config: Dialogue.Config = {}) {
  registerPrefix(ctx, config.prefix)

  ctx.command('teach', { authority: config.authority.base, checkUnknown: true, hideOptions: true })
    .userFields(['authority', 'id'])
    .usage(session => cheatSheet(session, config))
    .action(async (argv) => {
      const { options, session, args } = argv
      const argd: Dialogue.Argv = { app: ctx.app, session, args, config, options }
      return ctx.bail('dialogue/validate', argd)
        || ctx.bail('dialogue/execute', argd)
        || create(argd)
    })
}
