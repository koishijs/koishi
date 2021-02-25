import { Session, segment, MessageInfo, AuthorInfo, GroupInfo, UserInfo } from 'koishi-core'
import { DiscordBot } from './bot'
import * as DC from './types'
export const adaptUser = (user: DC.User): UserInfo => ({
  userId: user.id,
  avatar: user.avatar,
  username: user.username,
})

export const adaptAuthor = (author: DC.Author): AuthorInfo => ({
  ...adaptUser(author),
  nickname: author.username,
})

function adaptMessage(base: any, meta: DC.MessageCreateBody, session: MessageInfo = {}) {
  if (meta.author) {
    session.author = adaptAuthor(meta.author)
    session.userId = meta.author.id
  }
  session.content = meta.content
  return session
}

function adaptMessageSession(data: DC.Payload, meta: DC.MessageCreateBody, session: Partial<Session.Payload<Session.MessageAction>> = {}) {
  adaptMessage(data, meta, session)
  session.messageId = meta.id
  session.timestamp = new Date(meta.timestamp).valueOf()
  session.subtype = 'group'
  return session
}

function adaptMessageCreate(data: DC.Payload, meta: DC.MessageCreateBody, session: Partial<Session.Payload<Session.MessageAction>>) {
  adaptMessageSession(data, meta, session)
  session.groupId = meta.guild_id
  session.subtype = 'group'
  session.channelId = meta.channel_id
}

export function adaptSession(bot: DiscordBot, input: DC.Payload) {
  const session: Partial<Session.Payload<Session.MessageAction>> = {
    selfId: bot.selfId,
    platform: 'discord',
  }
  if (input.t === 'MESSAGE_CREATE') {
    session.type = 'message'
    adaptMessageCreate(input, input.d as DC.MessageCreateBody, session)
  }
  return new Session(bot.app, session)
}
