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
  if (meta.embeds.length === 0) {
    // pure message
    session.content = meta.content
    if (meta.attachments.length) {
      session.content += meta.attachments.map(v => segment('image', {
        url: v.url,
        file: v.filename,
      })).join('')
    }
    session.content = session.content.replace(/<@!(.+?)>/, (_, v) => segment('at', {
      id: v,
    }))
  } else {
    switch (meta.embeds[0].type) {
      case 'video':
        session.content = segment('video', { file: meta.embeds[0].url })
        break
      case 'image':
        session.content = segment('image', { file: meta.embeds[0].url })
        break
      case 'gifv':
        session.content = segment('video', { file: meta.embeds[0].video.url })
        break
      case 'link':
        session.content = segment('image', { url: meta.embeds[0].url, title: meta.embeds[0].title, content: meta.embeds[0].description })
        break
    }
  }
  return session
}

function adaptMessageSession(data: DC.Payload, meta: DC.MessageCreateBody, session: Partial<Session.Payload<Session.MessageAction>> = {}) {
  adaptMessage(data, meta, session)
  session.messageId = meta.id
  session.timestamp = new Date(meta.timestamp).valueOf()
  session.subtype = meta.guild_id ? 'group' : 'private'
  return session
}

function adaptMessageCreate(data: DC.Payload, meta: DC.MessageCreateBody, session: Partial<Session.Payload<Session.MessageAction>>) {
  adaptMessageSession(data, meta, session)
  session.groupId = meta.guild_id
  session.subtype = meta.guild_id ? 'group' : 'private'
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
    if (!session.content) return
    if (session.userId === bot.selfId) return
  }
  return new Session(bot.app, session)
}
