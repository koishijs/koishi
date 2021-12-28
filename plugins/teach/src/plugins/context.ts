import { Context, union, difference, defineProperty } from 'koishi'
import { Dialogue, equal } from '../utils'

declare module '../utils' {
  interface DialogueTest {
    guilds?: string[]
    reversed?: boolean
    partial?: boolean
  }

  interface Dialogue {
    guilds: string[]
  }

  namespace Dialogue {
    interface Config {
      useContext?: boolean
    }
  }
}

export const RE_GROUPS = /^\d+(,\d+)*$/

export default function apply(ctx: Context, config: Dialogue.Config) {
  if (config.useContext === false) return
  const authority = config.authority.context

  ctx.command('teach')
    .option('disable', '-d  在当前环境下禁用问答')
    .option('disableGlobal', '-D  在所有环境下禁用问答', { authority })
    .option('enable', '-e  在当前环境下启用问答')
    .option('enableGlobal', '-E  在所有环境下启用问答', { authority })
    .option('guilds', '-g <gids:string>  设置具体的生效环境', { authority, type: RE_GROUPS })
    .option('global', '-G  无视上下文搜索')
    .before(({ options, session }) => {
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
      let reversed: boolean, partial: boolean, guilds: string[]
      if (options.disable) {
        reversed = true
        partial = !options.enableGlobal
        guilds = [session.gid]
      } else if (options.disableGlobal) {
        reversed = !!options.guilds
        partial = false
        guilds = options.enable ? [session.gid] : []
      } else if (options.enableGlobal) {
        reversed = !options.guilds
        partial = false
        guilds = []
      } else {
        noContextOptions = !options.enable
        if (options['target'] ? options.enable : !options.global) {
          reversed = false
          partial = true
          guilds = [session.gid]
        }
      }

      defineProperty(options, 'reversed', reversed)
      defineProperty(options, 'partial', partial)
      if ('guilds' in options) {
        if (noContextOptions) {
          return '选项 -g, --guilds 必须与 -d/-D/-e/-E 之一同时使用。'
        } else {
          defineProperty(options, '_guilds', options.guilds ? options.guilds.split(',').map(id => `${session.platform}:${id}`) : [])
        }
      } else if (session.subtype !== 'group' && options['partial']) {
        return '非群聊上下文中请使用 -E/-D 进行操作或指定 -g, --guilds 选项。'
      } else {
        defineProperty(options, '_guilds', guilds)
      }
    })

  ctx.on('dialogue/modify', ({ options }, data) => {
    const { _guilds, partial, reversed } = options
    if (!_guilds) return
    if (!data.guilds) data.guilds = []
    if (partial) {
      const newGroups = !(data.flag & Dialogue.Flag.complement) === reversed
        ? difference(data.guilds, _guilds)
        : union(data.guilds, _guilds)
      if (!equal(data.guilds, newGroups)) {
        data.guilds = newGroups.sort()
      }
    } else {
      data.flag = data.flag & ~Dialogue.Flag.complement | (+reversed * Dialogue.Flag.complement)
      if (!equal(data.guilds, _guilds)) {
        data.guilds = _guilds.sort()
      }
    }
  })

  ctx.before('dialogue/search', ({ options }, test) => {
    test.partial = options.partial
    test.reversed = options.reversed
    test.guilds = options._guilds
  })

  ctx.on('dialogue/detail', ({ guilds, flag }, output, { session }) => {
    const thisGroup = session.subtype === 'group' && guilds.includes(session.gid)
    output.push(`生效环境：${flag & Dialogue.Flag.complement
      ? thisGroup
        ? guilds.length - 1 ? `除本群等 ${guilds.length} 个群外的所有群` : '除本群'
        : guilds.length ? `除 ${guilds.length} 个群外的所有群` : '全局'
      : thisGroup
        ? guilds.length - 1 ? `本群等 ${guilds.length} 个群` : '本群'
        : guilds.length ? `${guilds.length} 个群` : '全局禁止'}`)
  })

  ctx.on('dialogue/detail-short', ({ guilds, flag }, output, { session, options }) => {
    if (!options._guilds && session.subtype === 'group') {
      const isReversed = flag & Dialogue.Flag.complement
      const hasGroup = guilds.includes(session.gid)
      output.unshift(!isReversed === hasGroup ? isReversed ? 'E' : 'e' : isReversed ? 'd' : 'D')
    }
  })

  ctx.on('dialogue/receive', ({ session, test }) => {
    test.partial = true
    test.reversed = false
    test.guilds = [session.gid]
  })

  ctx.on('dialogue/test', (test, query) => {
    if (!test.guilds || !test.guilds.length) return
    query.$and.push({
      $or: [{
        flag: { [test.reversed ? '$bitsAllSet' : '$bitsAllClear']: Dialogue.Flag.complement },
        $and: test.guilds.map($el => ({ guilds: { $el } })),
      }, {
        flag: { [test.reversed ? '$bitsAllClear' : '$bitsAllSet']: Dialogue.Flag.complement },
        $not: { guilds: { $el: test.guilds } },
      }],
    })
  })
}
