import { Context, getTargetId, ContextType, Group, User, Session } from 'koishi-core'

export function apply (ctx: Context) {
  ctx.command('contextify <message...>', '在特定上下文中触发指令', { authority: 3 })
    .alias('ctxf')
    .userFields(['authority'])
    .before(session => !session.$app.database)
    .option('-u, --user [id]', '使用私聊上下文')
    .option('-d, --discuss [id]', '使用讨论组上下文')
    .option('-g, --group [id]', '使用群聊上下文')
    .option('-m, --member [id]', '使用当前群/讨论组成员上下文')
    .option('-t, --type [type]', '确定发送信息的子类型')
    .usage([
      '私聊的子类型包括 other（默认），friend，group，discuss。',
      '群聊的子类型包括 normal（默认），notice，anonymous。',
      '讨论组聊天没有子类型。',
    ].join('\n'))
    .action(async ({ session, options }, message) => {
      if (!message) return '请输入要触发的指令。'

      if (options.member) {
        if (session.messageType === 'private') {
          return '无法在私聊上下文使用 --member 选项。'
        }
        options[session.messageType] = session.$ctxId
        options.user = options.member
      }

      if (!options.user && !options.group && !options.discuss) {
        return '请提供新的上下文。'
      }

      const newSession = new Session(session)
      newSession.$send = session.$send.bind(session)
      newSession.$sendQueued = session.$sendQueued.bind(session)

      delete newSession.groupId
      delete newSession.discussId

      let ctxType: ContextType, ctxId: number
      if (options.discuss) {
        newSession.discussId = ctxId = +options.discuss
        newSession.messageType = 'discuss'
        newSession.messageType = ctxType = 'discuss'
      } else if (options.group) {
        newSession.groupId = ctxId = +options.group
        newSession.messageType = ctxType = 'group'
        newSession.subType = options.type || 'normal'
        delete newSession.$group
        await newSession.$observeGroup(Group.fields)
      } else {
        ctxId = newSession.userId
        ctxType = 'user'
        newSession.messageType = 'private'
        newSession.subType = options.type || 'other'
      }

      if (options.user) {
        const id = getTargetId(options.user)
        if (!id) return '未指定目标。'

        newSession.userId = id
        newSession.sender.userId = id

        delete newSession.$user
        const user = await newSession.$observeUser(User.fields)
        if (session.$user.authority <= user.authority) {
          return '权限不足。'
        }
      }

      if (options.group) {
        const info = await session.$bot.getGroupMemberInfo(ctxId, newSession.userId).catch(() => ({}))
        Object.assign(newSession.sender, info)
      } else if (options.user) {
        const info = await session.$bot.getStrangerInfo(newSession.userId).catch(() => ({}))
        Object.assign(newSession.sender, info)
      }

      newSession.$ctxId = ctxId
      newSession.$ctxType = ctxType

      return ctx.execute(message, newSession)
    })
}
