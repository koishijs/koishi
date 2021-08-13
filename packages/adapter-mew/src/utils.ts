import { MewBot } from './bot'
import * as Mew from './types'
import { AuthorInfo, MessageInfo, segment, Session, UserInfo, ChannelInfo, GroupInfo } from 'koishi-core'

export function adaptGroup(data: Mew.Node): GroupInfo {
  return {
    groupId: data.id,
    groupName: data.name,
  }
}

export function adaptChannel(data: Mew.Topic): ChannelInfo {
  return {
    channelId: data.id,
    channelName: data.name,
  }
}

export const adaptUser = (user: Mew.User, bot?: MewBot): UserInfo => ({
  userId: user.id,
  // avatar: user.objects.media[user.avator].url || '',
  username: user.username,
  // discriminator: user.,
  isBot: bot && user.id === bot.selfId || false,
})

export const adaptAuthor = (author: Mew.User, bot: MewBot): AuthorInfo => ({
  ...adaptUser(author, bot),
  nickname: author.name,
})

export function adaptMessage(bot: MewBot, meta: Mew.Message, session: Partial<Session> = {}) {
  if (meta.author_id) {
    session.author = adaptAuthor(meta.objects.users[meta.author_id], bot)
    session.userId = meta.author_id
  }

  session.content = ''
  if (meta.content) {
    session.content = meta.content
      .replace(/<@[!&](.+?)>/, (_, id) => {
        if (meta.mention_roles.includes(id)) {
          return segment('at', { role: id || '' })
        } else {
          if (id === bot.username) {
            return segment.at(id, { name: bot.username || '' })
          }
          const user = meta.mentions?.find(u => u.id === id)
          return segment.at(id, { name: user?.username || '' })
        }
      })
    // .replace(/<:(.*):(.+?)>/, (_, name, id) => segment('face', { id: id, name }))
    // .replace(/<a:(.*):(.+?)>/, (_, name, id) => segment('face', { id: id, name, animated: true }))
    // .replace(/@everyone/, () => segment('at', { type: 'all' }))
    // .replace(/@here/, () => segment('at', { type: 'here' }))
    // .replace(/<#(.+?)>/, (_, id) => {
    //   const channel = meta.mention_channels?.find(c => c.id === id)
    //   return segment.sharp(id, { name: channel?.name })
    // })
  }

  // 表情
  if (meta.stamp) {
    return segment('face', { id: meta.stamp })
  }

  // 媒体
  if (meta.media) {
    for (const mediaId of meta.media) {
      const media = meta.objects.media[mediaId]
      if (media.type.indexOf('image') > -1) {
        session.content += segment('image', { url: media.url })
      }
    }
  }

  return session as MessageInfo
}

function adaptMessageSession(bot: MewBot, meta: Mew.Message, session: Partial<Session> = {}) {
  adaptMessage(bot, meta, session)
  session.messageId = meta.id
  session.timestamp = new Date(meta.created_at).valueOf() || Date.now()
  // 遇到过 cross post 的消息在这里不会传消息 id
  // if (meta.message_reference) {
  //   const { message_id, channel_id } = meta.message_reference
  //   session.content = segment('quote', { id: message_id, channelId: channel_id }) + session.content
  // }
  return session
}

function prepareMessageSession(session: Partial<Session>, data: Mew.Message) {
  session.groupId = data.node_id
  session.subtype = data.node_id ? 'group' : 'private'
  session.channelId = data.topic_id
}

export async function adaptSession(bot: MewBot, input: Mew.Payload) {
  const session: Partial<Session> = {
    selfId: bot.selfId,
    platform: 'mew',
  }
  switch (input.event) {
    case Mew.EventType.MessageCreate: {
      session.type = 'message'
      prepareMessageSession(session, input.data)
      adaptMessageSession(bot, input.data, session)
      if (session.userId === bot.selfId) return
      break
    }
    case Mew.EventType.MessageDelete: {
      session.type = 'message-deleted'
      prepareMessageSession(session, input.data)
      break
    }
    default: return
  }

  return new Session(bot.app, session)
}
