import { Context } from 'koishi-core'

export default function apply (ctx: Context) {
  ctx.command('contextify <message...>', '在特定上下文中触发指令', { authority: 3 })
    .alias('ctxf')
    .option('-u, --user [id]', '使用私聊上下文')
    .option('-d, --discuss [id]', '使用讨论组上下文')
    .option('-g, --group [id]', '使用群聊上下文（默认）')
    .option('-t, --type [type]', '确定发送信息的子类型')
    .usage([
      '私聊的子类型包括 other（默认），friend，group，discuss。',
      '群聊的子类型包括 normal（默认），notice，anonymous。',
      '讨论组聊天没有子类型。',
      '如果同时设置了 -u 和 -g/-d，则会理解成对应的用户在群或讨论组里发言。',
    ].join('\n'))
    .action(async ({ meta, options }, message) => {
      const newMeta = { ...meta }
      if (!message) return meta.$send('请输入要发送的文本。')
      if (!options.user && !options.group && !options.discuss) return meta.$send('请提供新的上下文。')

      let user = meta.$user
      if (options.user) {
        const id = +options.user
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

      if (options.discuss) {
        newMeta.discussId = +options.discuss
        newMeta.messageType = 'discuss'
      } else if (options.group) {
        const id = +options.group
        newMeta.groupId = id
        newMeta.messageType = 'group'
        newMeta.subType = options.type || 'normal'
        Object.defineProperty(newMeta, '$group', {
          value: await ctx.database.observeGroup(id),
          writable: true,
        })
      } else {
        newMeta.messageType = 'private'
        newMeta.subType = options.type || 'other'
      }

      return ctx.app.executeCommandLine(message, newMeta)
    })
}
