import { Context, getTargetId, UserField } from 'koishi-core'
import { isInteger, deduplicate } from 'koishi-utils'
import { DialogueFlag } from '../database'

declare module '../database' {
  interface DialogueTest {
    writer?: number
  }

  interface Dialogue {
    writer: number
  }
}

declare module '../utils' {
  interface TeachArgv {
    userMap?: Record<number, string>
  }
}

export default function apply (ctx: Context) {
  ctx.command('teach')
    .option('-w, --writer <uid>', '添加或设置问题的作者')
    .option('-W, --anonymous', '添加或设置匿名问题')
    .option('-s, --substitute', '由教学者完成回答的执行')
    .option('-S, --no-substitute', '由触发者完成回答的执行')

  ctx.on('dialogue/before-fetch', (test, conditionals) => {
    if (test.writer !== undefined) conditionals.push(`\`writer\` = ${test.writer}`)
  })

  ctx.on('dialogue/validate', ({ options, meta }) => {
    if (options.noSubstitute) options.substitute = false

    if (options.anonymous) {
      options.writer = 0
    } else if (options.writer) {
      const writer = getTargetId(options.writer)
      if (!isInteger(writer) || writer <= 0) {
        return meta.$send('参数 -w, --writer 错误，请检查指令语法。')
      }
      options.writer = writer
    }
  })

  ctx.on('dialogue/permit', ({ meta, target }, dialogue) => {
    return target && dialogue.writer !== meta.$user.id && meta.$user.authority < 3
  })

  ctx.on('dialogue/permit', ({ meta, options }) => {
    return (options.regexp !== undefined || options.substitute !== undefined) && meta.$user.authority < 3
  })

  ctx.on('dialogue/before-detail', async (argv) => {
    argv.userMap = {}
    const { userMap, meta, dialogues } = argv
    const writers = deduplicate(dialogues.map(d => d.writer).filter(Boolean))
    const users = await ctx.database.getUsers(writers, ['id', 'name'])

    let hasUnnamed = false
    for (const user of users) {
      if (user.id === +user.name) {
        if (user.id === meta.userId) {
          user.name = meta.sender.card || meta.sender.nickname
        } else {
          hasUnnamed = true
        }
      } else {
        userMap[user.id] = user.name
      }
    }

    if (hasUnnamed && meta.messageType === 'group') {
      try {
        const members = await ctx.sender.getGroupMemberList(meta.groupId)
        for (const { userId, nickname, card } of members) {
          if (!userMap[userId]) {
            userMap[userId] = card || nickname
          }
        }
      } catch {}
    }
  })

  ctx.on('dialogue/detail', ({ writer, flag }, output, argv) => {
    if (writer) {
      const name = argv.userMap[writer]
      output.push(name ? `来源：${name} (${writer})` : `来源：${writer}`)
      // TODO: 匿名 -s 检测
      if (flag & DialogueFlag.substitute) {
        output.push('回答中的指令由教学者代行。')
      }
    }
  })

  ctx.on('dialogue/detail-short', ({ flag }, output) => {
    if (flag & DialogueFlag.substitute) {
      output.push('s')
    }
  })

  ctx.on('dialogue/before-search', ({ options }, test) => {
    test.writer = options.writer
  })

  ctx.on('dialogue/modify', ({ options, target, meta }, data) => {
    if (options.writer !== undefined) {
      data.writer = options.writer
    } else if (!target) {
      data.writer = meta.userId
    }

    if (options.substitute !== undefined) {
      data.flag &= ~DialogueFlag.substitute
      data.flag |= +options.substitute * DialogueFlag.substitute
    }
  })

  ctx.on('dialogue/before-send', async (state) => {
    const { dialogue, meta } = state
    if (dialogue.flag & DialogueFlag.substitute && dialogue.writer && meta.userId !== dialogue.writer) {
      const userFields = new Set<UserField>()
      ctx.app.emit(meta, 'dialogue/before-attach-user', state, userFields)
      meta.userId = dialogue.writer
      meta.$user = null
      await ctx.observeUser(meta, userFields)
    }
  })
}
