import { Context, getTargetId } from 'koishi-core'
import { isInteger, deduplicate } from 'koishi-utils'

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

  ctx.on('dialogue/before-fetch', (test, conditionals) => {
    if (test.writer !== undefined) conditionals.push(`\`writer\` = ${test.writer}`)
  })

  ctx.on('dialogue/validate', ({ options, meta }) => {
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

  ctx.on('dialogue/permit', ({ meta }, dialogue) => {
    return dialogue.writer !== meta.$user.id && meta.$user.authority < 3
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

  ctx.on('dialogue/detail', (dialogue, output, argv) => {
    if (dialogue.writer) {
      const name = argv.userMap[dialogue.writer]
      output.push(name ? `来源：${name} (${dialogue.writer})` : `来源：${dialogue.writer}`)
    }
  })

  ctx.on('dialogue/search', ({ options }, test) => {
    test.writer = options.writer
  })

  ctx.on('dialogue/modify', ({ options, target, meta }, data) => {
    if (options.writer !== undefined) {
      data.writer = options.writer
    } else if (!target) {
      data.writer = meta.userId
    }
  })
}
