import { Context, CommandConfig } from 'koishi-core'
import { CQCode } from 'koishi-utils'

export default function apply (ctx: Context, config: CommandConfig = {}) {
  ctx.command('contextify <message...>', '在特定上下文中触发指令', { authority: 3, ...config })
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

      if (options.user) {
        const id = +options.user
        if (id !== meta.userId) {
          const user = await ctx.database.getUser(id, -1, ['authority'])
          if (!user) return meta.$send('未找到用户。')
          if (meta.$user.authority <= user.authority) return meta.$send('权限不足。')
        }
        newMeta.userId = id
        newMeta.sender = {
          sex: 'unknown',
          nickname: '',
          userId: id,
          age: 0,
        }
      }

      if (options.discuss) {
        newMeta.discussId = +options.discuss
        newMeta.messageType = 'discuss'
      } else if (options.group) {
        newMeta.groupId = +options.group
        newMeta.messageType = 'group'
        newMeta.subType = options.type || 'normal'
      } else if (options.user) {
        newMeta.messageType = 'private'
        newMeta.subType = options.type || 'other'
      }

      newMeta.message = message
      newMeta.rawMessage = CQCode.unescape(message)
      await ctx.app.dispatchMeta(newMeta)
    })
}
