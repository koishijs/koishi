import { Context, getTargetId, User } from 'koishi-core'
import { isInteger, deduplicate } from 'koishi-utils'
import { Dialogue } from '../utils'

declare module '../utils' {
  interface DialogueTest {
    writer?: number
    frozen?: boolean
    substitute?: boolean
  }

  interface Dialogue {
    writer: number
  }

  namespace Dialogue {
    interface Argv {
      userMap?: Record<number, string>
      /** 用于保存用户权限的键值对，键的范围包括目标问答列表的全体作者以及 -w 参数 */
      authMap?: Record<number, number>
    }

    interface Config {
      useWriter?: boolean
    }
  }
}

export default function apply(ctx: Context, config: Dialogue.Config) {
  if (config.useWriter === false) return
  const { authority } = config

  ctx.command('teach')
    .option('frozen', '-f  锁定这个问答', { authority: authority.frozen })
    .option('frozen', '-F, --no-frozen  解锁这个问答', { authority: authority.frozen, value: false })
    .option('writer', '-w <uid>  添加或设置问题的作者')
    .option('writer', '-W, --anonymous  添加或设置匿名问题', { authority: authority.writer, value: 0 })
    .option('substitute', '-s  由教学者完成回答的执行')
    .option('substitute', '-S, --no-substitute  由触发者完成回答的执行', { value: false })

  ctx.emit('dialogue/flag', 'frozen')
  ctx.emit('dialogue/flag', 'substitute')

  ctx.on('dialogue/validate', ({ options }) => {
    if (options.writer) {
      const writer = getTargetId(options.writer)
      if (!isInteger(writer) || writer <= 0) {
        return '参数 -w, --writer 错误，请检查指令语法。'
      }
      options.writer = writer
    }
  })

  ctx.on('dialogue/before-detail', async (argv) => {
    argv.userMap = {}
    argv.authMap = {}
    const { options, userMap, session, dialogues, authMap } = argv
    const writers = deduplicate(dialogues.map(d => d.writer).filter(Boolean))
    const fields: User.Field[] = ['id', 'authority', session.kind]
    if (options.writer && !writers.includes(options.writer)) writers.push(options.writer)
    if (!options.modify) fields.push('name')
    const users = await ctx.database.getUser(writers, fields)

    let hasUnnamed = false
    for (const user of users) {
      authMap[user.id] = user.authority
      if (options.modify) continue
      if (user.id !== +user.name) {
        userMap[user.id] = user.name
      } else if (user[session.kind] === session.userId) {
        userMap[user.id] = session.sender.card || session.sender.nickname
      } else {
        hasUnnamed = true
      }
    }

    if (!options.modify && hasUnnamed && session.subType === 'group') {
      try {
        const memberMap = await session.$bot.getGroupMemberMap(session.groupId)
        for (const userId in memberMap) {
          userMap[userId] = userMap[userId] || memberMap[userId]
        }
      } catch { }
    }
  })

  ctx.on('dialogue/detail', ({ writer, flag }, output, argv) => {
    if (flag & Dialogue.Flag.frozen) output.push('此问答已锁定。')
    if (writer) {
      const name = argv.userMap[writer]
      output.push(name ? `来源：${name} (${writer})` : `来源：${writer}`)
      if (flag & Dialogue.Flag.substitute) {
        output.push('回答中的指令由教学者代行。')
      }
    }
  })

  // 当修改问答时，如果问答的作者不是本人，需要 admin 级权限
  // 当添加和修改问答时，如果问答本身是代行模式或要将问答设置成代行模式，则需要权限高于问答原作者
  // 当使用 -w 时需要原作者权限高于目标用户
  // 锁定的问答需要 frozen 级权限才能修改
  ctx.on('dialogue/permit', ({ session, target, options, authMap }, { writer, flag }) => {
    const { substitute, writer: newWriter } = options
    const { id, authority } = session.$user
    return (
      (newWriter && authority <= authMap[newWriter] && newWriter !== id) ||
      ((flag & Dialogue.Flag.frozen) && authority < config.authority.frozen) ||
      (writer !== id && (
        (target && authority < config.authority.admin) || (
          (substitute || (flag & Dialogue.Flag.substitute)) &&
          (authority <= (authMap[writer] || config.authority.base))
        )
      ))
    )
  })

  ctx.on('dialogue/detail-short', ({ flag }, output) => {
    if (flag & Dialogue.Flag.frozen) output.push('锁定')
    if (flag & Dialogue.Flag.substitute) output.push('代行')
  })

  ctx.on('dialogue/before-search', ({ options }, test) => {
    test.writer = options.writer
  })

  ctx.on('dialogue/before-modify', async ({ options, authMap }) => {
    if (options.writer && !(options.writer in authMap)) {
      return '指定的目标用户不存在。'
    }
  })

  ctx.on('dialogue/modify', ({ options, session, target }, data) => {
    if (options.writer !== undefined) {
      // FIXME
      data.writer = options.writer
    } else if (!target) {
      data.writer = session.$user.id
    }
  })

  // 触发代行者模式
  ctx.on('dialogue/before-send', async (state) => {
    const { dialogue, session } = state
    if (dialogue.flag & Dialogue.Flag.substitute && dialogue.writer && session.$user.id !== dialogue.writer) {
      const userFields = new Set<User.Field>()
      ctx.app.emit(session, 'dialogue/before-attach-user', state, userFields)
      // FIXME
      session.userId = dialogue.writer
      session.$user = null
      await session.$observeUser(userFields)
    }
  })
}
