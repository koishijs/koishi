import { isInteger } from 'koishi-utils'
import { Context, getTargetId, updateUsage, Meta, UserField } from 'koishi-core'
import { TeachConfig, simplifyQuestion, simplifyAnswer, TeachArgv, idSplit, deleteDuplicate } from './utils'
import info from './info'
import receiver from './receiver'
import search from './search'
import shortcut from './shortcut'
import teach from './teach'
import update from './update'
import { Dialogue } from './database'

export * from './database'
export * from './utils'

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'dialogue/modify' (argv: TeachArgv): any
    'dialogue/before-attach-user' (meta: Meta<'message'>, userFields: Set<UserField>): any
    'dialogue/attach-user' (meta: Meta<'message'>): any
    'dialogue/before-send' (meta: Meta<'message'>): any
    'dialogue/after-send' (meta: Meta<'message'>): any
  }
}

declare module 'koishi-core/dist/meta' {
  interface Meta {
    $dialogues?: Dialogue[]
  }
}

export const name = 'teach'

export function apply (ctx: Context, config: TeachConfig = {}) {
  ctx.plugin(shortcut, config)
  ctx.plugin(receiver, config)

  ctx.command('teach', '添加教学对话', {
    authority: 2,
    checkUnknown: true,
    maxUsage: user => user.authority === 2 ? 20 : Infinity,
  })
    .userFields(['usage', 'authority'])
    .alias('教学')
    .option('-q, --question <question>', '问题', { isString: true, hidden: true })
    .option('-a, --answer <answer>', '回答', { isString: true, hidden: true })
    .option('-s, --search', '搜索已有问答', { notUsage: true, isString: true, hidden: true })
    .option('-t, --target <ids>', '查看或修改已有问题', { isString: true, hidden: true })
    .option('-r, --remove', '彻底删除问答', { hidden: true })
    .option('--info', '查看教学信息', { notUsage: true, hidden: true })
    .option('-k, --keyword', '使用关键词匹配', { hidden: true })
    // .option('-K, --no-keyword', '取消使用关键词匹配')
    .option('-f, --frozen', '锁定这个问答', { authority: 4, hidden: true })
    .option('-F, --no-frozen', '解锁这个问答', { authority: 4, noNegated: true, hidden: true })
    .option('-w, --writer <uid>', '添加或设置问题的作者', { hidden: true })
    .option('-W, --anonymous', '添加或设置匿名问题', { hidden: true })
    .option('-d, --disable', '在当前环境下禁用问答', { hidden: true })
    .option('-D, --disable-global', '在所有环境下禁用问答', { hidden: true })
    .option('-e, --enable', '在当前环境下启用问答', { hidden: true })
    .option('-E, --enable-global', '在所有环境下启用问答', { hidden: true })
    .option('-g, --groups <gids>', '设置具体的生效环境', { isString: true, hidden: true })
    .option('-G, --global', '无视上下文搜索', { hidden: true })
    .option('-p, --probability <prob>', '设置问题的触发权重', { hidden: true })
    .option('-P, --page <page>', '设置搜索结果的页码', { hidden: true })
    .option('-m, --min-affinity <aff>', '设置最小好感度', { hidden: true })
    .option('-M, --max-affinity <aff>', '设置最大好感度', { hidden: true })
    .option('--auto-merge', '自动合并相同的问题和回答', { hidden: true })
    .option('--set-pred <ids>', '设置前置问题 (<<)', { isString: true, hidden: true })
    .option('--add-pred <ids>', '添加前置问题 (<)', { isString: true, hidden: true })
    .option('--set-succ <ids>', '设置后继问题 (>>)', { isString: true, hidden: true })
    .option('--add-succ <ids>', '添加后继问题 (>)', { isString: true, hidden: true })
    .usage('输入 # 查看教学系统用法示例。')
    .action(async ({ options, meta, args }) => {
      if (!meta.message.startsWith('#') && !updateUsage('$teachHint', meta.$user, { maxUsage: 1 })) {
        return meta.$send('四季酱 v2 已经实装了全新的教学语法，详见：https://Shigma.github.io/shiki-v2/teach')
      }

      if (args.length) {
        return meta.$send('存在多余的参数，请检查指令语法或将含有空格或换行的问答置于一对引号内。')
      }

      if (!Object.keys(options).length) {
        return meta.$send([
          '教学系统基本用法：',
          '　添加问答：# 问题 回答',
          '　查询回答：## 问题',
          '　查询问题：## ~ 回答',
          '　查看问答：#id',
          '　修改问题：#id 问题',
          '　修改回答：#id ~ 回答',
          '　删除问答：#id -r',
          '搜索选项：',
          '　使用关键词搜索：　-k',
          '　设置搜索结果页码：-P',
          '　关键词搜索，自动合并搜索结果：###',
          '上下文选项：',
          '　允许本群：　　　-e',
          '　全局允许：　　　-E',
          '　禁止本群：　　　-d',
          '　全局禁止：　　　-D',
          '　无视上下文搜索：-G',
          '问答选项：',
          '　设置前置问题：　<< id',
          '　添加前置问题：　< id',
          '　设置后继问题：　>> id',
          '　添加后继问题：　> id',
          '　设置触发权重：　-p prob',
          '　设置问题作者：　-w uid',
          '　设置为匿名：　　-W',
          '　设置最小好感度：-m aff',
          '　设置最大好感度：-M aff',
          '特殊语法：',
          '　$$：一个普通的 $ 字符',
          '　$0：收到的原文本',
          '　$n：分条发送',
          '　$a：@说话人',
          '　$m：@四季酱',
          '　$s：说话人的名字',
        ].join('\n'))
      }

      if (meta.messageType !== 'group' && meta.$user.authority < 3) {
        return meta.$send('私聊教学需要 3 级权限，您的权限不足。')
      }

      const argv: TeachArgv = { ctx, meta, args, config, options }

      if (options.target && !/^\d+(,\d+)*$/.exec(options.target)) {
        return meta.$send('参数 -t, --target 错误，请检查指令语法。')
      }

      const page = options.page
      if (page !== undefined && !(isInteger(page) && page > 0)) {
        return meta.$send('参数 -P, --page 应为正整数。')
      }

      const prob = options.probability
      if (prob !== undefined && !(prob > 0 && prob <= 1)) {
        return meta.$send('参数 -p, --probability 应为不超过 1 的正数。')
      }

      const minAff = options.minAffinity
      if (minAff !== undefined && !(isInteger(minAff) && minAff >= 0 && minAff <= 32768)) {
        return meta.$send('参数 -m, --min-affinity 应为非负整数。')
      }

      const maxAff = options.maxAffinity
      if (maxAff !== undefined && !(isInteger(maxAff) && maxAff >= 0 && maxAff <= 32768)) {
        return meta.$send('参数 -M, --max-affinity 应为正整数。')
      }

      if (options.anonymous) {
        options.writer = 0
      } else if (options.writer) {
        const writer = getTargetId(options.writer)
        if (!isInteger(writer) || writer <= 0) {
          return meta.$send('参数 -w, --writer 错误，请检查指令语法。')
        }
        options.writer = writer
      }

      function parseOption (key: string, fullname: string, prop = key) {
        if (/^\d+(,\d+)*$/.test(options[key])) {
          argv[prop] = idSplit(options[key])
        } else {
          return meta.$send(`参数 ${fullname} 错误，请检查指令语法。`)
        }
      }

      let errorPromise: Promise<void>

      if ('setPred' in options) {
        if ('addPred' in options) {
          return meta.$send('选项 --set-pred, --add-pred 不能同时使用。')
        } else {
          if (errorPromise = parseOption('setPred', '--set-pred', 'predecessors')) return errorPromise
          argv.predOverwrite = true
        }
      } else if ('addPred' in options) {
        if (errorPromise = parseOption('addPred', '--add-pred', 'predecessors')) return errorPromise
        argv.predOverwrite = false
      }

      if ('setSucc' in options) {
        if ('addSucc' in options) {
          return meta.$send('选项 --set-succ, --add-succ 不能同时使用。')
        } else {
          if (errorPromise = parseOption('setSucc', '--set-succ', 'successors')) return errorPromise
          argv.succOverwrite = true
        }
      } else if ('addSucc' in options) {
        if (errorPromise = parseOption('addSucc', '--add-succ', 'successors')) return errorPromise
        argv.succOverwrite = false
      }

      let noDisableEnable = false
      if (options.disable) {
        argv.reversed = true
        argv.partial = true
        argv.groups = ['' + meta.groupId]
      } else if (options.disableGlobal) {
        argv.reversed = !!options.groups
        argv.partial = false
        argv.groups = []
      } else if (options.enableGlobal) {
        argv.reversed = !options.groups
        argv.partial = false
        argv.groups = []
      } else {
        noDisableEnable = !options.enable
        if (options.target ? options.enable : !options.global) {
          argv.reversed = false
          argv.partial = true
          argv.groups = ['' + meta.groupId]
        }
      }

      if ('groups' in options) {
        if (noDisableEnable) {
          return meta.$send('参数 -g, --groups 必须与 -d/-D/-e/-E 之一同时使用。')
        } else if (errorPromise = parseOption('groups', '-g, --groups')) {
          return errorPromise
        }
      } else if (meta.messageType !== 'group' && argv.partial) {
        return meta.$send('非群聊上下文中请使用 -E/-D 进行操作或指定 -g, --groups 参数。')
      }

      if (String(options.question).includes('[CQ:image,')) {
        return meta.$send('问题不能包含图片。')
      }

      options.question = simplifyQuestion(options.question)
      if (options.question) {
        options.original = options.question
      } else {
        delete options.question
      }

      options.answer = simplifyAnswer(options.answer)
      if (!options.answer) {
        delete options.answer
      }

      if (options.target) {
        argv.target = deleteDuplicate(idSplit(options.target))
        delete options.target
        delete options.t
        return update(argv)
      }

      if (options.info) return info(argv)
      if (options.search) return search(argv)

      return teach(argv)
    })
}
