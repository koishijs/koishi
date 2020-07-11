import { Context, getTargetId, UserField } from 'koishi-core'
import { isInteger, deduplicate } from 'koishi-utils'
import { DialogueFlag } from '../database'

declare module '../database' {
  interface DialogueTest {
    writer?: number
    substitute?: boolean
  }

  interface Dialogue {
    writer: number
  }
  
  namespace Dialogue {
    interface Argv {
      userMap?: Record<number, string>
      authMap?: Record<number, number>
    }
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
    if (test.substitute) {
      conditionals.push(`(\`flag\` & ${DialogueFlag.substitute})`)
    } else if (test.substitute === false) {
      conditionals.push(`!(\`flag\` & ${DialogueFlag.substitute})`)
    }
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

  ctx.on('dialogue/permit', ({ meta, target, options, authMap = {} }, dialogue) => {
    // 当修改问答时，如果问答的作者不是本人，需要 3 级权限
    // 当添加和修改问答时，如果问答本身是代行模式或要将问答设置成代行模式，则需要权限高于问答原作者
    // 如果原问答是匿名则视为 2 级权限（本身 2 级权限的代行模式无意义，可认定代行模式需要 3 级权限）
    return dialogue.writer !== meta.$user.id && (
      (target && meta.$user.authority < 3) || (
        (options.substitute || dialogue.flag & DialogueFlag.substitute) && 
        meta.$user.authority <= (authMap[dialogue.writer] || 2)
      )
    )
  })

  ctx.on('dialogue/before-detail', async (argv) => {
    argv.userMap = {}
    argv.authMap = {}
    const { userMap, meta, dialogues, authMap } = argv
    const writers = deduplicate(dialogues.map(d => d.writer).filter(Boolean))
    const users = await ctx.database.getUsers(writers, ['id', 'name', 'authority'])

    let hasUnnamed = false
    for (const user of users) {
      authMap[user.id] = user.authority
      if (user.id !== +user.name) {
        userMap[user.id] = user.name
      } else if (user.id === meta.userId) {
        userMap[user.id] = meta.sender.card || meta.sender.nickname
      } else {
        hasUnnamed = true
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
      if (flag & DialogueFlag.substitute) {
        output.push('回答中的指令由教学者代行。')
      }
    }
  })

  ctx.on('dialogue/detail-short', ({ flag }, output) => {
    if (flag & DialogueFlag.substitute) {
      output.push('教学者执行')
    }
  })

  ctx.on('dialogue/before-search', ({ options }, test) => {
    test.writer = options.writer
    test.substitute = options.substitute
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
      await meta.observeUser(userFields)
    }
  })
}
