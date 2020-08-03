import { Context, getTargetId, ContextType, Group, User, Meta } from 'koishi-core'

export function apply (ctx: Context) {
  ctx.command('contextify <message...>', '在特定上下文中触发指令', { authority: 3 })
    .alias('ctxf')
    .userFields(['authority'])
    .before(meta => !meta.$app.database)
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
    .action(async ({ meta, options }, message) => {
      if (!message) return meta.$send('请输入要触发的指令。')

      if (options.member) {
        if (meta.messageType === 'private') {
          return meta.$send('无法在私聊上下文使用 --member 选项。')
        }
        options[meta.messageType] = meta.$ctxId
        options.user = options.member
      }

      if (!options.user && !options.group && !options.discuss) {
        return meta.$send('请提供新的上下文。')
      }

      const newMeta = new Meta(meta)
      newMeta.$send = meta.$send.bind(meta)
      newMeta.$sendQueued = meta.$sendQueued.bind(meta)

      delete newMeta.groupId
      delete newMeta.discussId

      let ctxType: ContextType, ctxId: number
      if (options.discuss) {
        newMeta.discussId = ctxId = +options.discuss
        newMeta.messageType = 'discuss'
        newMeta.messageType = ctxType = 'discuss'
      } else if (options.group) {
        newMeta.groupId = ctxId = +options.group
        newMeta.messageType = ctxType = 'group'
        newMeta.subType = options.type || 'normal'
        delete newMeta.$group
        await newMeta.observeGroup(Group.fields)
      } else {
        ctxId = newMeta.userId
        ctxType = 'user'
        newMeta.messageType = 'private'
        newMeta.subType = options.type || 'other'
      }

      if (options.user) {
        const id = getTargetId(options.user)
        if (!id) return meta.$send('未指定目标。')

        newMeta.userId = id
        newMeta.sender.userId = id

        delete newMeta.$user
        const user = await newMeta.observeUser(User.fields)
        if (meta.$user.authority <= user.authority) {
          return meta.$send('权限不足。')
        }
      }

      if (options.group) {
        const info = await meta.$bot.getGroupMemberInfo(ctxId, newMeta.userId).catch(() => ({}))
        Object.assign(newMeta.sender, info)
      } else if (options.user) {
        const info = await meta.$bot.getStrangerInfo(newMeta.userId).catch(() => ({}))
        Object.assign(newMeta.sender, info)
      }

      newMeta.$ctxId = ctxId
      newMeta.$ctxType = ctxType

      return ctx.execute(message, newMeta)
    })
}
