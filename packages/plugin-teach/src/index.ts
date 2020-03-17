import { isInteger } from 'koishi-utils'
import { Context, getTargetId } from 'koishi-core'
import { TeachConfig, simplifyQuestion, simplifyAnswer, TeachArgv, idSplit, deleteDuplicate } from './utils'
import info from './info'
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
export * from './update'
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
  }
}

export const name = 'teach'

export function apply (ctx: Context, config: TeachConfig = {}) {
  ctx.plugin(shortcut, config)
  ctx.plugin(receiver, config)

  ctx.command('teach', '添加教学对话', { authority: 2, checkUnknown: true })
    .alias('教学')
    .option('-q, --question <question>', '问题', { isString: true, hidden: true })
    .option('-a, --answer <answer>', '回答', { isString: true, hidden: true })
    .option('-s, --search', '搜索已有问答', { notUsage: true, isString: true, hidden: true })
    .option('-t, --target <ids>', '查看或修改已有问题', { isString: true, hidden: true })
    .option('-r, --remove', '彻底删除问答', { hidden: true })
    .option('--info', '查看教学信息', { notUsage: true, hidden: true })
    .option('-k, --keyword', '使用关键词匹配', { hidden: true })
    // .option('-K, --no-keyword', '取消使用关键词匹配')
    .option('-p, --probability <prob>', '设置问题的触发权重', { hidden: true })
    .option('-P, --page <page>', '设置搜索结果的页码', { hidden: true })
    .option('--auto-merge', '自动合并相同的问题和回答', { hidden: true })
    .usage('输入 # 查看教学系统用法示例。')
    .action(async ({ options, meta, args }) => {
      if (args.length) {
        return meta.$send('存在多余的参数，请检查指令语法或将含有空格或换行的问答置于一对引号内。')
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

      const result = ctx.bail('dialogue/validate', argv)
      if (result) return result

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

  ctx.plugin(context, config)
  ctx.plugin(freeze, config)
  ctx.plugin(throttle, config)
  ctx.plugin(preventLoop, config)
  ctx.plugin(successor, config)
  ctx.plugin(writer, config)
}
