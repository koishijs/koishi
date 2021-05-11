import { KaiheilaBot } from './bot'
import { Session, segment, MessageInfo, AuthorInfo, GroupInfo, UserInfo } from 'koishi-core'
import { camelCase } from 'koishi-utils'
import * as KHL from './types'

export const adaptGroup = (data: KHL.Guild): GroupInfo => ({
  groupId: data.id,
  groupName: data.name,
})

export const adaptUser = (user: KHL.User): UserInfo => ({
  userId: user.id,
  avatar: user.avatar,
  username: user.username,
  discriminator: user.identifyNum,
})

export const adaptAuthor = (author: KHL.Author): AuthorInfo => ({
  ...adaptUser(author),
  nickname: author.nickname,
})

function adaptMessage(base: KHL.MessageBase, meta: KHL.MessageMeta, session: MessageInfo = {}) {
  if (meta.author) {
    session.author = adaptAuthor(meta.author)
    session.userId = meta.author.id
  }
  if (base.type === KHL.Type.text) {
    const users = new Map<string, string>()
    const channels = new Set<string>()
    session.content = base.content
      .replace(/@(.+?)#(\d+)/, (_, $1, $2) => (users.set($2, $1), `[CQ:at,id=${$2}]`))
      .replace(/@全体成员/, () => `[CQ:at,type=all]`)
      .replace(/@在线成员/, () => `[CQ:at,type=here]`)
      .replace(/@role:(\d+);/, (_, $1) => `[CQ:at,role=${$1}]`)
      .replace(/#channel:(\d+);/, (_, $1) => (channels.add($1), `[CQ:sharp,id=${$1}]`))
    session.mention = {
      everyone: meta.mentionAll || meta.mentionHere,
      roles: meta.mentionRoles.map(id => ({ id })),
      channels: [...channels].map(channelId => ({ channelId })),
      users: [...users].map(([userId, username]) => ({ userId, username })),
    }
  } else if (base.type === KHL.Type.image) {
    session.content = segment('image', { url: base.content, file: meta.attachments.name })
  }
  return session
}

function adaptMessageSession(data: KHL.Data, meta: KHL.MessageMeta, session: Partial<Session.Payload<Session.MessageAction>> = {}) {
  adaptMessage(data, meta, session)
  session.messageId = data.msgId
  session.timestamp = data.msgTimestamp
  session.subtype = data.channelType === 'GROUP' ? 'group' : 'private'
  if (meta.quote) {
    session.quote = adaptMessage(meta.quote, meta.quote)
    session.quote.messageId = meta.quote.id
    session.quote.channelId = session.channelId
    session.quote.subtype = session.subtype
  }
  return session
}

function adaptMessageCreate(data: KHL.Data, meta: KHL.MessageExtra, session: Partial<Session.Payload<Session.MessageAction>>) {
  adaptMessageSession(data, meta, session)
  session.groupId = meta.guildId
  session.channelName = meta.channelName
  if (data.channelType === 'GROUP') {
    session.subtype = 'group'
    session.channelId = data.targetId
  } else {
    session.subtype = 'private'
    session.channelId = meta.code
  }
}

function adaptMessageModify(data: KHL.Data, meta: KHL.NoticeBody, session: Partial<Session.Payload<Session.MessageAction>>) {
  adaptMessageSession(data, meta, session)
  session.messageId = meta.msgId
  session.channelId = meta.channelId
}

export function adaptSession(bot: KaiheilaBot, input: any) {
  const data = camelCase<KHL.Data>(input)
  const session: Partial<Session.Payload<Session.MessageAction>> = {
    selfId: bot.selfId,
    platform: 'kaiheila',
  }
  if (data.type === KHL.Type.system) {
    const { type, body } = data.extra as KHL.Notice
    switch (type) {
      case 'updated_message':
      case 'updated_private_message':
        session.type = 'message-updated'
        adaptMessageModify(data, body, session)
        break
      case 'deleted_message':
      case 'deleted_private_message':
        session.type = 'message-deleted'
        adaptMessageModify(data, body, session)
        break
      default: return
    }
  } else {
    session.type = 'message'
    adaptMessageCreate(data, data.extra as KHL.MessageExtra, session)
    if (!session.content) return
    if (session.userId === bot.selfId) return
  }
  return new Session(bot.app, session)
}
