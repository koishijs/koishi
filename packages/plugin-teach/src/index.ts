import { isInteger } from 'koishi-utils'
import { Context, ParsedCommandLine, getTargetId } from 'koishi-core'
import { TeachConfig, simplifyQuestion, simplifyAnswer, ParsedTeachLine, splitGroups } from './utils'
import info from './info'
import receiver from './receiver'
import search from './search'
import teach from './teach'
import update from './update'

export * from './database'
export * from './utils'

export const name = 'teach'

export function apply (ctx: Context, config: TeachConfig = {}) {
  ctx.plugin(receiver, config)

  const command = ctx.command('teach <question> <answer>', '添加教学对话', { authority: 2, checkUnknown: true, ...config })
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
      .option('-d, --disable', '在当前环境下禁用问答')
      .option('-D, --disable-global', '在所有环境下禁用问答')
      .option('-e, --enable', '在当前环境下启用问答')
      .option('-E, --enable-global', '在所有环境下启用问答')
      .option('-g, --groups [groups]', '设置具体的生效环境', { isString: true })
  }
}

async function parseOptions (ctx: Context, config: TeachConfig, argv: ParsedCommandLine) {
  const { options, meta, args } = argv
  const argc = args.length

  if (typeof options.chance === 'number' && (options.chance <= 0 || options.chance > 1)) {
    return meta.$send('参数 -c, --chance 应为不超过 1 的正数。')
  }

  const parsed: ParsedTeachLine = Object.create({ ctx, meta, argc, args, options, config })

  if (config.useWriter) {
    if (options.noWriter) {
      parsed.writer = 0
    } else if (options.writer) {
      const writer = getTargetId(options.writer)
      if (!isInteger(writer) || writer <= 0) {
        return meta.$send('参数 -w, --writer 错误，请检查指令语法。')
      }
      parsed.writer = writer
    }
  }

  if (config.useEnvironment) {
    if (options.disable) {
      parsed.reversed = true
      parsed.partial = true
      parsed.groups = [meta.groupId]
    } else if (options.enable) {
      parsed.reversed = false
      parsed.partial = true
      parsed.groups = [meta.groupId]
    } else if (options.disableGlobal) {
      parsed.reversed = true
      parsed.partial = false
      parsed.groups = []
    } else if (options.enableGlobal) {
      parsed.reversed = false
      parsed.partial = false
      parsed.groups = []
    }

    if (options.groups) {
      if (/^\d+(,\d+)*$/.test(options.groups)) {
        parsed.groups = splitGroups(options.groups)
      } else {
        return meta.$send('参数 -g, --groups 错误，请检查指令语法。')
      }
    }
  }

  if (String(options.question).includes('[CQ:image,')) {
    return meta.$send('问题不能包含图片。')
  }

  options.question = simplifyQuestion(options.question)
  if (!options.question) delete options.question
  options.answer = simplifyAnswer(options.answer)
  if (!options.answer) delete options.answer

  return parsed
}
