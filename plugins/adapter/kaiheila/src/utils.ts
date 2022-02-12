import { Adapter, Bot, Session, segment, camelCase, Schema, App } from 'koishi'
import * as KHL from './types'

export interface AdapterConfig extends Adapter.WebSocketClient.Config {
  path?: string
}

export const AdapterConfig: Schema<AdapterConfig> = Schema.intersect([
  Schema.object({
    path: Schema.string().description('服务器监听的路径，仅用于 http 协议。').default('/kaiheila'),
  }),
  Adapter.WebSocketClient.Config,
])

export const adaptGroup = (data: KHL.Guild): Bot.Guild => ({
  guildId: data.id,
  guildName: data.name,
})

export const adaptUser = (user: KHL.User): Bot.User => ({
  userId: user.id,
  avatar: user.avatar,
  username: user.username,
  discriminator: user.identifyNum,
})

export const adaptAuthor = (author: KHL.Author): Bot.Author => ({
  ...adaptUser(author),
  nickname: author.nickname,
})

function adaptMessage(base: KHL.MessageBase, meta: KHL.MessageMeta, session: Bot.MessageBase = {}) {
  if (meta.author) {
    session.author = adaptAuthor(meta.author)
    session.userId = meta.author.id
  }
  if (base.type === KHL.Type.text) {
    session.content = base.content
      .replace(/@(.+?)#(\d+)/, (_, $1, $2) => segment.at($2, { name: $1 }))
      .replace(/@全体成员/, () => `[CQ:at,type=all]`)
      .replace(/@在线成员/, () => `[CQ:at,type=here]`)
      .replace(/@role:(\d+);/, (_, $1) => `[CQ:at,role=${$1}]`)
      .replace(/#channel:(\d+);/, (_, $1) => segment.sharp($1))
  } else if (base.type === KHL.Type.image) {
    session.content = segment('image', { url: base.content, file: meta.attachments.name })
  }
  return session
}

function adaptMessageSession(data: KHL.Data, meta: KHL.MessageMeta, session: Partial<Session> = {}) {
  adaptMessage(data, meta, session)
  session.messageId = data.msgId
  session.timestamp = data.msgTimestamp
  const subtype = data.channelType === 'GROUP' ? 'group' : 'private'
  session.subtype = subtype
  if (meta.quote) {
    session.quote = adaptMessage(meta.quote, meta.quote)
    session.quote.messageId = meta.quote.id
    session.quote.channelId = session.channelId
    session.quote.subtype = subtype
  }
  return session
}

function adaptMessageCreate(data: KHL.Data, meta: KHL.MessageExtra, session: Partial<Session>) {
  adaptMessageSession(data, meta, session)
  session.guildId = meta.guildId
  session.channelName = meta.channelName
  if (data.channelType === 'GROUP') {
    session.subtype = 'group'
    session.channelId = data.targetId
  } else {
    session.subtype = 'private'
    session.channelId = meta.code
  }
}

function adaptMessageModify(data: KHL.Data, meta: KHL.NoticeBody, session: Partial<Session>) {
  adaptMessageSession(data, meta, session)
  session.messageId = meta.msgId
  session.channelId = meta.channelId
}

function adaptReaction(body: KHL.NoticeBody, session: Partial<Session>) {
  session.channelId = body.channelId
  session.messageId = body.msgId
  session.userId = body.userId
  session['emoji'] = body.emoji.id
}

export function adaptSession(bot: Bot, input: any) {
  const data = camelCase<KHL.Data>(input)
  const session: Partial<Session> = {
    selfId: bot.selfId,
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
      case 'added_reaction':
      case 'private_added_reaction':
        session.type = 'reaction-added'
        adaptReaction(body, session)
        break
      case 'deleted_reaction':
      case 'private_deleted_reaction':
        session.type = 'reaction-deleted'
        adaptReaction(body, session)
        break
      default: return
    }
  } else {
    session.type = 'message'
    adaptMessageCreate(data, data.extra as KHL.MessageExtra, session)
    if (!session.content) return
    if (session.userId === bot.selfId) return
  }
  return new Session(bot, session)
}
