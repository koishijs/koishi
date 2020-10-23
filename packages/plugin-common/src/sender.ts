import { Context, getTargetId, Group, Session, User } from 'koishi-core'
import { CQCode } from 'koishi-utils'

export interface SenderConfig {
  operator?: number
}

export default function apply(ctx: Context, config: SenderConfig = {}) {
  ctx.command('broadcast <message...>', '全服广播', { authority: 4 })
    .before(session => !session.$app.database)
    .option('forced', '-f  无视 silent 标签进行广播')
    .option('only', '-o  仅向当前 Bot 负责的群进行广播')
    .action(async ({ options, session }, message) => {
      if (!message) return '请输入要发送的文本。'
      if (!options.only) {
        await ctx.broadcast(message, options.forced)
        return
      }

      let groups = await ctx.database.getAllGroups(['id', 'flag'], [session.selfId])
      if (!options.forced) {
        groups = groups.filter(g => !(g.flag & Group.Flag.silent))
      }
      await session.$bot.broadcast(groups.map(g => g.id), message)
    })

  ctx.command('echo <message...>', '向当前上下文发送消息', { authority: 2 })
    .option('anonymous', '-a  匿名发送消息', { authority: 3 })
    .option('forceAnonymous', '-A  匿名发送消息', { authority: 3 })
    .option('unescape', '-e  发送非转义的消息', { authority: 3 })
    .action(async ({ options }, message) => {
      if (!message) return '请输入要发送的文本。'

      if (options.unescape) {
        message = CQCode.unescape(message)
      }

      if (options.forceAnonymous) {
        message = CQCode.stringify('anonymous') + message
      } else if (options.anonymous) {
        message = CQCode.stringify('anonymous', { ignore: true }) + message
      }

      return message
    })

  const interactions: Record<number, number> = {}

  config.operator && ctx.command('feedback <message...>', '发送反馈信息给作者')
    .userFields(['name', 'id'])
    .action(async ({ session }, text) => {
      if (!text) return '请输入要发送的文本。'
      const { $username: name, userId } = session
      const nickname = name === '' + userId ? userId : `${name} (${userId})`
      const message = `收到来自 ${nickname} 的反馈信息：\n${text}`
      const id = await session.$bot.sendPrivateMsg(config.operator, message)
      interactions[id] = userId
      return '反馈信息发送成功！'
    })

  ctx.middleware((session, next) => {
    const { $reply, $parsed } = session
    if (!$parsed || !$reply) return next()
    const userId = interactions[$reply.messageId]
    if (!userId) return next()
    return session.$bot.sendPrivateMsg(userId, $parsed)
  })

  ctx.command('contextify <message...>', '在特定上下文中触发指令', { authority: 3 })
    .alias('ctxf')
    .userFields(['authority'])
    .before(session => !session.$app.database)
    .option('user', '-u [id]  使用私聊上下文')
    .option('group', '-g [id]  使用群聊上下文')
    .option('member', '-m [id]  使用当前群/讨论组成员上下文')
    .option('type', '-t [type]  确定发送信息的子类型')
    .usage([
      '私聊的子类型包括 other（默认），friend，group。',
      '群聊的子类型包括 normal（默认），notice，anonymous。',
      '讨论组聊天没有子类型。',
    ].join('\n'))
    .action(async ({ session, options }, message) => {
      if (!message) return '请输入要触发的指令。'

      if (options.member) {
        if (session.messageType === 'private') {
          return '无法在私聊上下文使用 --member 选项。'
        }
        options.group = session.groupId
        options.user = options.member
      }

      if (!options.user && !options.group) {
        return '请提供新的上下文。'
      }

      const newSession = new Session(ctx.app, session)
      newSession.$send = session.$send.bind(session)
      newSession.$sendQueued = session.$sendQueued.bind(session)

      delete newSession.groupId

      if (!options.group) {
        newSession.messageType = 'private'
        newSession.subType = options.type || 'other'
        delete newSession.$group
      } else if (options.group !== session.groupId) {
        newSession.groupId = +options.group
        newSession.messageType = 'group'
        newSession.subType = options.type || 'normal'
        delete newSession.$group
        await newSession.$observeGroup(Group.fields)
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
        const info = await session.$bot.getGroupMemberInfo(newSession.groupId, newSession.userId).catch(() => ({}))
        Object.assign(newSession.sender, info)
      } else if (options.user) {
        const info = await session.$bot.getStrangerInfo(newSession.userId).catch(() => ({}))
        Object.assign(newSession.sender, info)
      }

      return newSession.$execute(message)
    })
}
