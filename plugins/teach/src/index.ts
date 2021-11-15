/* eslint-disable no-irregular-whitespace */

import { Argv, Context, Session, escapeRegExp, merge, Schema, Time } from 'koishi'
import { Dialogue } from './utils'
import internal from './internal'
import receiver from './receiver'
import search from './search'
import update, { create } from './update'
import context from './plugins/context'
import throttle from './plugins/throttle'
import probability from './plugins/probability'
import successor from './plugins/successor'
import time from './plugins/time'
import writer from './plugins/writer'
import {} from '@koishijs/plugin-console'
import {} from '@koishijs/plugin-status'
import { resolve } from 'path'

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

export type Config = Dialogue.Config

declare module 'koishi' {
  interface EventMap {
    'dialogue/validate'(argv: Dialogue.Argv): void | string
    'dialogue/execute'(argv: Dialogue.Argv): void | Promise<void | string>
  }

  interface Modules {
    teach: typeof import('.')
  }
}

declare module '@koishijs/plugin-status' {
  namespace MetaProvider {
    interface Payload extends Dialogue.Stats {}
  }

  namespace StatisticsProvider {
    interface Payload {
      questions: QuestionData[]
    }
  }
}

interface QuestionData {
  name: string
  value: number
}

const cheatSheet = (session: Session<'authority'>, config: Config) => {
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

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    prefix: Schema.string('教学指令的前缀。').default('#'),
    historyTimeout: Schema.number('教学操作在内存中的保存时间。').default(Time.minute * 10),
  }, '通用设置'),

  Schema.object({
    authority: Schema.object({
      base: Schema.number('可访问教学系统的权限等级。').default(2),
      admin: Schema.number('可修改非自己创建的问答的权限等级。').default(3),
      context: Schema.number('可修改上下文设置的权限等级。').default(3),
      frozen: Schema.number('可修改锁定的问答的权限等级。').default(4),
      regExp: Schema.number('可使用正则表达式的权限等级。').default(3),
      writer: Schema.number('可设置作者或匿名的权限等级。').default(2),
    }),
  }, '权限设置'),

  Schema.object({
    maxRedirections: Schema.number('问题重定向的次数上限。').default(3),
    successorTimeout: Schema.number('问答触发后继问答的持续时间。').default(Time.second * 20),
    appellationTimeout: Schema.number('称呼作为问题触发的后续效果持续时间。').default(Time.minute * 10),
  }, '触发设置'),

  Schema.object({
    maxPreviews: Schema.number('同时查看的最大问答数量。').default(10),
    previewDelay: Schema.number('显示两个问答之间的时间间隔。').default(Time.second * 0.5),
    itemsPerPage: Schema.number('搜索结果每一页显示的最大数量。').default(30),
    maxAnswerLength: Schema.number('搜索结果中回答显示的长度限制。').default(100),
    mergeThreshold: Schema.number('合并搜索模式中，相同的问题和回答被合并的最小数量。').default(5),
  }, '显示设置'),
])

function registerPrefix(ctx: Context, prefix: string) {
  const g = '\\d+(?:\\.\\.\\d+)?'
  const last = prefix[prefix.length - 1]
  const p = escapeRegExp(prefix)
  const l = escapeRegExp(last)
  const teachRegExp = new RegExp(`^${p}(${l}?)((${g}(?:,${g})*)?|${l}?)$`)
  //                                   $1     $2

  ctx.on('parse', (argv, session) => {
    if (argv.root && session.quote || !argv.tokens.length) return
    let { content } = argv.tokens[0]
    if (argv.root && session.parsed.prefix) {
      content = session.parsed.prefix + content
    }
    const capture = teachRegExp.exec(content)
    if (!capture) return

    argv.tokens.shift()
    argv.tokens.forEach(Argv.revert)
    argv.source = session.parsed.content
    argv.options = {}
    const { length } = argv.tokens
    if (capture[1] === last) {
      if (!argv.tokens.length) {
        return 'teach.status'
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
      receive: 1,
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

  // options
  ctx.plugin(internal, config)
  ctx.plugin(context, config)
  ctx.plugin(throttle, config)
  ctx.plugin(probability, config)
  ctx.plugin(successor, config)
  ctx.plugin(time, config)
  ctx.plugin(writer, config)

  ctx.with(['console'], (ctx) => {
    const { stats, meta } = ctx.console.sources

    ctx.on('dialogue/before-send', ({ session, dialogue }) => {
      session._sendType = 'dialogue'
      stats.sync.addDaily('dialogue', dialogue.id)
      stats.upload()
    })

    meta.extend(() => Dialogue.stats(ctx))

    stats.extend(async (payload, data) => {
      const dialogueMap = stats.average(data.daily.map(data => data.dialogue))
      const dialogues = await ctx.database.get('dialogue', Object.keys(dialogueMap).map(i => +i), ['id', 'original'])
      const questionMap: Record<string, QuestionData> = {}
      for (const dialogue of dialogues) {
        const { id, original: name } = dialogue
        if (name.includes('[CQ:') || name.startsWith('hook:')) continue
        if (!questionMap[name]) {
          questionMap[name] = {
            name,
            value: dialogueMap[id],
          }
        } else {
          questionMap[name].value += dialogueMap[id]
        }
      }
      payload.questions = Object.values(questionMap)
    })

    const filename = ctx.console.config.devMode ? '../client/index.ts' : '../dist/index.js'
    ctx.console.addEntry(resolve(__dirname, filename))
  })
}
