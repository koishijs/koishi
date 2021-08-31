import { Adapter, Bot, Session, camelCase, renameProperty, paramCase, segment } from 'koishi'
import * as qface from 'qface'
import * as OneBot from './types'

export * from './types'

export interface SharedConfig extends Adapter.WebSocketClient.Config {
  path?: string
  secret?: string
  responseTimeout?: number
}

export const adaptUser = (user: OneBot.AccountInfo): Bot.User => ({
  userId: user.userId.toString(),
  avatar: `http://q.qlogo.cn/headimg_dl?dst_uin=${user.userId}&spec=640`,
  username: user.nickname,
})

export const adaptGroupMember = (user: OneBot.SenderInfo): Bot.GuildMember => ({
  ...adaptUser(user),
  nickname: user.card,
  roles: [user.role],
})

export const adaptAuthor = (user: OneBot.SenderInfo, anonymous?: OneBot.AnonymousInfo): Bot.Author => ({
  ...adaptUser(user),
  nickname: anonymous?.name || user.card,
  anonymous: anonymous?.flag,
  roles: [user.role],
})

export function adaptMessage(message: OneBot.Message): Bot.Message {
  const author = adaptAuthor(message.sender, message.anonymous)
  const result: Bot.Message = {
    author,
    userId: author.userId,
    messageId: message.messageId.toString(),
    timestamp: message.time * 1000,
    content: segment.transform(message.message, {
      at({ qq }) {
        if (qq !== 'all') return segment.at(qq)
        return segment('at', { type: 'all' })
      },
      face: ({ id }) => segment('face', { id, url: qface.getUrl(id) }),
      reply: (data) => segment('quote', data),
    }),
  }
  if (message.groupId) {
    result.guildId = result.channelId = message.groupId.toString()
  } else {
    result.channelId = 'private:' + author.userId
  }
  return result
}

export const adaptGroup = (group: OneBot.GroupInfo): Bot.Guild => ({
  guildId: group.groupId.toString(),
  guildName: group.groupName,
})

export const adaptChannel = (group: OneBot.GroupInfo): Bot.Channel => ({
  channelId: group.groupId.toString(),
  channelName: group.groupName,
})

export function adaptSession(data: any) {
  const session = camelCase<Session>(data)
  session.platform = 'onebot'
  session.selfId = '' + session.selfId
  renameProperty(session, 'type', 'postType')
  renameProperty(session, 'subtype', 'subType')

  if (data.post_type === 'message') {
    Object.assign(session, adaptMessage(session as any))
    renameProperty(session, 'subtype', 'messageType')
    return session
  }

  renameProperty(session, 'guildId', 'groupId')
  if (session.userId) session.userId = '' + session.userId
  if (session.guildId) session.guildId = session.channelId = '' + session.guildId
  if (session.targetId) session.targetId = '' + session.targetId
  if (session.operatorId) session.operatorId = '' + session.operatorId

  if (data.post_type === 'request') {
    delete session['requestType']
    renameProperty(session, 'content', 'comment')
    renameProperty(session, 'messageId', 'flag')
    if (data.request_type === 'friend') {
      session.type = 'friend-request'
      session.channelId = `private:${session.userId}`
    } else if (data.sub_type === 'add') {
      session.type = 'guild-member-request'
    } else {
      session.type = 'guild-request'
    }
  } else if (data.post_type === 'notice') {
    delete session['noticeType']
    switch (data.notice_type) {
      case 'group_recall':
        session.type = 'message-deleted'
        session.subtype = 'group'
        break
      case 'friend_recall':
        session.type = 'message-deleted'
        session.subtype = 'private'
        session.channelId = `private:${session.userId}`
        break
      case 'friend_add':
        session.type = 'friend-added'
        break
      case 'group_upload':
        session.type = 'group-file-added'
        break
      case 'group_admin':
        session.type = 'group-member'
        session.subtype = 'role'
        break
      case 'group_ban':
        session.type = 'group-member'
        session.subtype = 'ban'
        break
      case 'group_decrease':
        session.type = session.userId === session.selfId ? 'group-deleted' : 'group-member-deleted'
        session.subtype = session.userId === session.operatorId ? 'active' : 'passive'
        break
      case 'group_increase':
        session.type = session.userId === session.selfId ? 'group-added' : 'group-member-added'
        session.subtype = session.userId === session.operatorId ? 'active' : 'passive'
        break
      case 'group_card':
        session.type = 'group-member'
        session.subtype = 'nickname'
        break
      case 'notify':
        session.type = 'notice'
        session.subtype = paramCase(data.sub_type)
        if (session.subtype === 'poke') {
          session.channelId ||= `private:${session.userId}`
        } else if (session.subtype === 'honor') {
          session.subsubtype = paramCase(data.honor_type)
        }
        break
    }
  } else return

  return session
}
