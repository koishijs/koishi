import { Context, getTargetId, ContextType } from 'koishi-core'

export default function apply (ctx: Context) {
  ctx.command('contextify <message...>', '在特定上下文中触发指令', { authority: 3 })
    .alias('ctxf')
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
      if (!message) return meta.$send('请输入要发送的文本。')

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

      const newMeta = { ...meta }
      let user = meta.$user
      if (options.user) {
        const id = getTargetId(options.user)
        if (!id) return meta.$send('未指定目标。')
        user = await ctx.database.observeUser(id)
        if (meta.$user.authority <= user.authority) {
          return meta.$send('权限不足。')
        }

        newMeta.userId = id
        newMeta.sender = {
          sex: 'unknown',
          nickname: '',
          userId: id,
          age: 0,
        }
      }

      Object.defineProperty(newMeta, '$user', { value: user, writable: true })

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
        Object.defineProperty(newMeta, '$group', {
          value: await ctx.database.observeGroup(ctxId),
          writable: true,
        })
      } else {
        ctxId = newMeta.userId
        ctxType = 'user'
        newMeta.messageType = 'private'
        newMeta.subType = options.type || 'other'
      }

      // generate path
      Object.defineProperty(newMeta, '$ctxId', { value: ctxId })
      Object.defineProperty(newMeta, '$ctxType', { value: ctxType })

      return ctx.app.executeCommandLine(message, newMeta)
    })
}
