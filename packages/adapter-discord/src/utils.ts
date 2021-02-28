import { Session, segment, MessageInfo, AuthorInfo, GroupInfo, UserInfo, ChannelInfo } from 'koishi-core'
import { DiscordBot } from './bot'
import * as DC from './types'
import { DiscordChannel, PartialGuild } from './types'

export const adaptUser = (user: DC.DiscordUser): UserInfo => ({
  userId: user.id,
  avatar: user.avatar,
  username: user.username,
})

export function adaptGroup(data: PartialGuild): GroupInfo {
  return {
    groupId: data.id,
    groupName: data.name,
  }
}

export function adaptChannel(data: DiscordChannel): ChannelInfo {
  return {
    channelId: data.id,
    channelName: data.name,
  }
}

export const adaptAuthor = (author: DC.Author): AuthorInfo => ({
  ...adaptUser(author),
  nickname: author.username,
})

export function adaptMessage(bot: DiscordBot, meta: DC.DiscordMessage, session: MessageInfo = {}) {
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
    session.content = session.content
      .replace(/<@!(.+?)>/, (_, v) => segment('at', { id: v }))
      .replace(/<@&(.+?)>/, (_, v) => segment('at', { id: v }))
      .replace(/<:(.*):(.+?)>/, (_, __, v) => segment('face', { id: v, name: __ }))
      .replace(/@everyone/, () => segment('at', { type: 'all' }))
      .replace(/@here/, () => segment('at', { type: 'here' }))
      .replace(/<#(.+?)>/, (_, v) => segment('sharp', { id: v }))
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
        session.content = segment('share', { url: meta.embeds[0].url, title: meta.embeds[0]?.title, content: meta.embeds[0]?.description })
        break
    }
  }
  return session
}

async function adaptMessageSession(bot: DiscordBot, meta: DC.DiscordMessage, session: Partial<Session.Payload<Session.MessageAction>> = {}) {
  adaptMessage(bot, meta, session)
  session.messageId = meta.id
  session.timestamp = new Date(meta.timestamp).valueOf()
  session.subtype = meta.guild_id ? 'group' : 'private'
  if (meta.message_reference) {
    const msg = await bot.getMessageFromServer(meta.message_reference.channel_id, meta.message_reference.message_id)
    session.quote = await adaptMessage(bot, msg)
    session.quote.messageId = meta.message_reference.message_id
    session.quote.channelId = meta.message_reference.channel_id
  }
  return session
}

async function adaptMessageCreate(bot: DiscordBot, meta: DC.DiscordMessage, session: Partial<Session.Payload<Session.MessageAction>>) {
  await adaptMessageSession(bot, meta, session)
  session.groupId = meta.guild_id
  session.subtype = meta.guild_id ? 'group' : 'private'
  session.channelId = meta.channel_id
}

async function adaptMessageModify(bot: DiscordBot, meta: DC.DiscordMessage, session: Partial<Session.Payload<Session.MessageAction>>) {
  await adaptMessageSession(bot, meta, session)
  session.groupId = meta.guild_id
  session.subtype = meta.guild_id ? 'group' : 'private'
  session.channelId = meta.channel_id
}

export async function adaptSession(bot: DiscordBot, input: DC.Payload) {
  const session: Partial<Session.Payload<Session.MessageAction>> = {
    selfId: bot.selfId,
    platform: 'discord',
  }
  if (input.t === 'MESSAGE_CREATE') {
    session.type = 'message'
    await adaptMessageCreate(bot, input.d as DC.DiscordMessage, session)
    if (!session.content) return
    if (session.userId === bot.selfId) return
  } else if (input.t === 'MESSAGE_UPDATE') {
    session.type = 'message-updated'
    await adaptMessageModify(bot, input.d as DC.DiscordMessage, session)
    if (!session.content) return
    if (session.userId === bot.selfId) return
  } else if (input.t === 'MESSAGE_DELETE') {
    session.type = 'message-deleted'
    session.messageId = input.d.id
  }
  return new Session(bot.app, session)
}
