import { KaiheilaBot } from './bot'
import { Session, CQCode, MessageInfo, AuthorInfo, GroupInfo } from 'koishi-core'
import { camelCase } from 'koishi-utils'
import * as KHL from './types'

export function adaptGroup(data: KHL.Guild): GroupInfo {
  return {
    groupId: data.id,
    name: data.name,
  }
}

export function adaptUser(author: KHL.User): AuthorInfo {
  return {
    userId: author.id,
    avatar: author.avatar,
    username: author.username,
    nickname: author.nickname,
  }
}

function adaptMessage(base: KHL.MessageBase, author: KHL.Author, session: MessageInfo = {}) {
  session.author = adaptUser(author)
  session.userId = author.id
  if (base.type === KHL.Type.text) {
    session.content = base.content
      .replace(/@(.+?)#(\d+)/, (_, $1, $2) => `[CQ:at,qq=${$2}]`)
      .replace(/@全体成员/, () => `[CQ:at,type=all]`)
      .replace(/@在线成员/, () => `[CQ:at,type=here]`)
      .replace(/@role:(\d+);/, (_, $1) => `[CQ:at,role=${$1}]`)
      .replace(/#channel:(\d+);/, (_, $1) => `[CQ:sharp,id=${$1}]`)
  } else if (base.type === KHL.Type.image) {
    session.content = CQCode('image', { url: base.content })
  }
  return session
}

function adaptMessageSession(data: KHL.Data, meta: KHL.MessageMeta, session: Partial<Session.Payload<Session.MessageAction>> = {}) {
  adaptMessage(data, meta.author, session)
  session.groupId = meta.guildId
  session.channelName = meta.channelName
  session.messageId = data.msgId
  session.timestamp = data.msgTimestamp
  if (data.channelType === 'GROUP') {
    session.subtype = 'group'
    session.channelId = data.targetId
  } else {
    session.subtype = 'private'
    session.channelId = meta.code
  }
  session.subtype = data.channelType === 'GROUP' ? 'group' : 'private'
  if (meta.quote) {
    session.$reply = adaptMessage(meta.quote, meta.quote.author)
    session.$reply.messageId = meta.quote.id
    session.$reply.channelId = session.channelId
    session.$reply.subtype = session.subtype
  }
  return session
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
        adaptMessageSession(data, body, session)
        break
      case 'deleted_message':
      case 'deleted_private_message':
        session.type = 'message-deleted'
        adaptMessageSession(data, body, session)
        break
      default: return
    }
  } else {
    session.type = 'message'
    adaptMessageSession(data, data.extra as KHL.MessageExtra, session)
  }
  return new Session(bot.app, session)
}
