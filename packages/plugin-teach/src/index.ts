import { Context } from 'koishi-core'
import info from './info'
import parseOptions, { TeachConfig } from './utils'
import receiver from './receiver'
import search from './search'
import teach from './teach'
import update from './update'

export * from './database'
export { TeachConfig }

export function apply (ctx: Context, config: TeachConfig = {}) {
  ctx.plugin(receiver, config)

  const command = ctx.command('teach <question> <answer>', '教四季酱说话', { authority: 2, checkUnknown: true, ...config })
    .alias('教学')
    .shortcut('教学信息', { options: { info: true } })
    .shortcut('全局教学信息', { options: { info: true, allEnv: true } })
    .option('-q, --question <question>', '搜索或修改已有问题', { notUsage: true, isString: true })
    .option('-a, --answer <answer>', '搜索或修改已有回答', { notUsage: true, isString: true })
    .option('--all', '搜索全部问答')
    .option('-k, --keyword', '使用关键词匹配')
    .option('-c, --chance <value>', '设置问题的触发概率')
    .option('-u, --update <id>', '查看或修改已有问题', { notUsage: true, isString: true })
    .option('-D, --delete', '彻底删除问题或回答')
    .option('-i, --info', '查看教学信息', { notUsage: true })
    .action(async (parsedArgv, question: string, answer: string) => {
      const parsedOptions = await parseOptions(ctx, config, parsedArgv)
      if (!parsedOptions) return

      const { options } = parsedArgv
      if (options.update) return update(parsedOptions)
      if (options.info) return info(parsedOptions)
      if (options.question || options.answer || options.all) return search(parsedOptions)

      return teach(parsedOptions, question, answer)
    })

  if (config.useWriter) {
    command
      .option('-w, --writer <qq>', '添加或设置问题的作者')
      .option('-W, --anonymous', '添加或设置匿名问题')
  }

  if (config.useFrozen) {
    command
      .option('-f, --frozen', '锁定这个问答', { authority: 4 })
      .option('-F, --no-frozen', '解锁这个问答', { authority: 4, noNegated: true })
  }

  if (config.useEnvironment) {
    command
      .option('-d, --disable', '在当前环境下禁用问题或回答')
      .option('-e, --env <environment>', '设置问题的生效环境', { isString: true })
      .option('-E, --all-env', '搜索所有环境中的问答')
      .option('-g, --global-env', '设置全局生效环境，相当于 -e=*')
      .option('-n, --no-env', '设置无生效环境，相当于 -e=""', { noNegated: true })
  }
}
