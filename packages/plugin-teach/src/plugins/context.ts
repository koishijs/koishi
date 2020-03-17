import { Context } from 'koishi-core'
import { contain, intersection, union, difference } from 'koishi-utils'
import { DialogueFlag } from '../database'
import { idEqual, idSplit, TeachConfig } from '../utils'

declare module '../utils' {
  interface TeachArgv {
    groups?: string[]
    partial?: boolean
    reversed?: boolean
  }
}

declare module '../database' {
  interface DialogueTest {
    groups?: string[]
    reversed?: boolean
    partial?: boolean
  }

  interface Dialogue {
    groups: string[]
  }
}

export default function apply (ctx: Context, config: TeachConfig) {
  ctx.command('teach')
    .option('-d, --disable', '在当前环境下禁用问答', { hidden: true })
    .option('-D, --disable-global', '在所有环境下禁用问答', { hidden: true })
    .option('-e, --enable', '在当前环境下启用问答', { hidden: true })
    .option('-E, --enable-global', '在所有环境下启用问答', { hidden: true })
    .option('-g, --groups <gids>', '设置具体的生效环境', { isString: true, hidden: true })
    .option('-G, --global', '无视上下文搜索', { hidden: true })

  ctx.on('dialogue/filter-stateless', (data, test) => {
    if (!test.groups) return
    const sameFlag = !(data.flag & DialogueFlag.reversed) !== test.reversed
    if (test.partial) {
      return sameFlag
        ? !contain(data.groups, test.groups)
        : !!intersection(data.groups, test.groups).length
    } else {
      return !sameFlag || !idEqual(test.groups, data.groups)
    }
  })

  ctx.on('dialogue/validate', async (argv) => {
    const { options, meta } = argv
    function parseOption (key: string, fullname: string, prop = key) {
      if (/^\d+(,\d+)*$/.test(options[key])) {
        argv[prop] = idSplit(options[key])
      } else {
        return meta.$send(`参数 ${fullname} 错误，请检查指令语法。`)
      }
    }

    let errorPromise: Promise<void>

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
  })

  ctx.on('dialogue/modify', ({ groups, partial, reversed }, data) => {
    if (!groups) return
    if (!data.groups) data.groups = []
    if (partial) {
      const newGroups = !(data.flag & DialogueFlag.reversed) === reversed
        ? difference(data.groups, groups)
        : union(data.groups, groups)
      if (!idEqual(data.groups, newGroups)) {
        data.groups = newGroups
      }
    } else {
      data.flag = data.flag & ~DialogueFlag.reversed | (+reversed * DialogueFlag.reversed)
      if (!idEqual(data.groups, groups)) {
        data.groups = groups.slice()
      }
    }
  })

  ctx.on('dialogue/detail', (dialogue, output, argv) => {
    const groups = dialogue.groups
    output.push(`生效环境：${dialogue.flag & DialogueFlag.reversed
      ? groups.includes('' + argv.meta.groupId)
        ? groups.length - 1 ? `除本群等 ${groups.length} 个群外的所有群` : '除本群'
        : groups.length ? `除 ${groups.length} 个群外的所有群` : '全局'
      : groups.includes('' + argv.meta.groupId)
        ? groups.length - 1 ? `本群等 ${groups.length} 个群` : '本群'
        : groups.length ? `${groups.length} 个群` : '全局禁止'}`)
  })
}
