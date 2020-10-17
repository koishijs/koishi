import { Context } from 'koishi-core'
import { union, difference } from 'koishi-utils'
import { Dialogue, equal, RE_GROUPS } from '../utils'

declare module '../utils' {
  interface DialogueTest {
    groups?: string[]
    reversed?: boolean
    partial?: boolean
  }

  interface Dialogue {
    groups: string[]
  }

  namespace Dialogue {
    interface Argv {
      groups?: string[]
      partial?: boolean
      reversed?: boolean
    }

    interface Config {
      useContext?: boolean
    }
  }
}

export default function apply(ctx: Context, config: Dialogue.Config) {
  if (config.useContext === false) return
  const authority = config.authority.context

  ctx.command('teach')
    .option('disable', '-d  在当前环境下禁用问答')
    .option('disableGlobal', '-D  在所有环境下禁用问答', { authority })
    .option('enable', '-e  在当前环境下启用问答')
    .option('enableGlobal', '-E  在所有环境下启用问答', { authority })
    .option('groups', '-g <gids>  设置具体的生效环境', { authority, type: 'string', validate: RE_GROUPS })
    .option('global', '-G  无视上下文搜索')

  ctx.on('dialogue/validate', (argv) => {
    const { options, session } = argv

    if (options.disable && options.enable) {
      return '选项 -d, -e 不能同时使用。'
    } else if (options.disableGlobal && options.enableGlobal) {
      return '选项 -D, -E 不能同时使用。'
    } else if (options.disableGlobal && options.disable) {
      return '选项 -D, -d 不能同时使用。'
    } else if (options.enable && options.enableGlobal) {
      return '选项 -E, -e 不能同时使用。'
    }

    let noContextOptions = false
    if (options.disable) {
      argv.reversed = true
      argv.partial = !options.enableGlobal
      argv.groups = ['' + session.groupId]
    } else if (options.disableGlobal) {
      argv.reversed = !!options.groups
      argv.partial = false
      argv.groups = options.enable ? ['' + session.groupId] : []
    } else if (options.enableGlobal) {
      argv.reversed = !options.groups
      argv.partial = false
      argv.groups = []
    } else {
      noContextOptions = !options.enable
      if (options.target ? options.enable : !options.global) {
        argv.reversed = false
        argv.partial = true
        argv.groups = ['' + session.groupId]
      }
    }

    if ('groups' in options) {
      if (noContextOptions) {
        return '选项 -g, --groups 必须与 -d/-D/-e/-E 之一同时使用。'
      } else {
        argv.groups = options.groups ? options.groups.split(',') : []
      }
    } else if (session.messageType !== 'group' && argv.partial) {
      return '非群聊上下文中请使用 -E/-D 进行操作或指定 -g, --groups 选项。'
    }
  })

  ctx.on('dialogue/modify', ({ groups, partial, reversed }, data) => {
    if (!groups) return
    if (!data.groups) data.groups = []
    if (partial) {
      const newGroups = !(data.flag & Dialogue.Flag.complement) === reversed
        ? difference(data.groups, groups)
        : union(data.groups, groups)
      if (!equal(data.groups, newGroups)) {
        data.groups = newGroups.sort()
      }
    } else {
      data.flag = data.flag & ~Dialogue.Flag.complement | (+reversed * Dialogue.Flag.complement)
      if (!equal(data.groups, groups)) {
        data.groups = groups.sort()
      }
    }
  })

  ctx.on('dialogue/before-search', ({ reversed, partial, groups }, test) => {
    test.partial = partial
    test.reversed = reversed
    test.groups = groups
  })

  ctx.on('dialogue/detail', ({ groups, flag }, output, { session }) => {
    const thisGroup = session.messageType === 'group' && groups.includes('' + session.groupId)
    output.push(`生效环境：${flag & Dialogue.Flag.complement
      ? thisGroup
        ? groups.length - 1 ? `除本群等 ${groups.length} 个群外的所有群` : '除本群'
        : groups.length ? `除 ${groups.length} 个群外的所有群` : '全局'
      : thisGroup
        ? groups.length - 1 ? `本群等 ${groups.length} 个群` : '本群'
        : groups.length ? `${groups.length} 个群` : '全局禁止'}`)
  })

  ctx.on('dialogue/detail-short', ({ groups, flag }, output, argv) => {
    if (!argv.groups && argv.session.messageType === 'group') {
      const isReversed = flag & Dialogue.Flag.complement
      const hasGroup = groups.includes('' + argv.session.groupId)
      output.unshift(!isReversed === hasGroup ? isReversed ? 'E' : 'e' : isReversed ? 'd' : 'D')
    }
  })

  ctx.on('dialogue/receive', ({ session, test }) => {
    test.partial = true
    test.reversed = false
    test.groups = ['' + session.groupId]
  })
}
