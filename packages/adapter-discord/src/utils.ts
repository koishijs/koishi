/* eslint-disable camelcase */
import { AuthorInfo, ChannelInfo, GroupInfo, MessageInfo, segment, Session, UserInfo } from 'koishi-core'
import { DiscordBot } from './bot'
import * as DC from './types'

export const adaptUser = (user: DC.DiscordUser): UserInfo => ({
  userId: user.id,
  avatar: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
  username: user.username,
  discriminator: user.discriminator,
  isBot: user.bot || false,
})

export function adaptGroup(data: DC.PartialGuild | DC.Guild): GroupInfo {
  return {
    groupId: data.id,
    groupName: data.name,
  }
}

export function adaptChannel(data: DC.Channel): ChannelInfo {
  return {
    channelId: data.id,
    channelName: data.name,
  }
}

export const adaptAuthor = (author: DC.User): AuthorInfo => ({
  ...adaptUser(author),
  nickname: author.username,
})

export function adaptMessage(bot: DiscordBot, meta: DC.Message, session: Partial<Session> = {}) {
  if (meta.author) {
    session.author = adaptAuthor(meta.author)
    session.userId = meta.author.id
  }
  if (meta.member?.nick) {
    session.author.nickname = meta.member?.nick
  }

  // TODO remove in a future version
  session.discord = {
    webhook_id: meta.webhook_id,
    flags: meta.flags,
  }

  // https://discord.com/developers/docs/reference#message-formatting
  session.content = ''
  if (meta.content) {
    session.content = meta.content
      .replace(/<@[!&](.+?)>/, (_, id) => {
        if (meta.mention_roles.includes(id)) {
          return segment('at', { role: id })
        } else {
          const user = meta.mentions?.find(u => u.id === id)
          return segment.at(id, { name: user?.username })
        }
      })
      .replace(/<:(.*):(.+?)>/, (_, name, id) => segment('face', { id: id, name }))
      .replace(/<a:(.*):(.+?)>/, (_, name, id) => segment('face', { id: id, name, animated: true }))
      .replace(/@everyone/, () => segment('at', { type: 'all' }))
      .replace(/@here/, () => segment('at', { type: 'here' }))
      .replace(/<#(.+?)>/, (_, id) => {
        const channel = meta.mention_channels?.find(c => c.id === id)
        return segment.sharp(id, { name: channel?.name })
      })
  }

  // embed 的 update event 太阴间了 只有 id embeds channel_id guild_id 四个成员
  if (meta.attachments?.length) {
    session.content += meta.attachments.map(v => {
      if (v.height && v.width && v.content_type?.startsWith('image/')) {
        return segment('image', {
          url: v.url,
          proxy_url: v.proxy_url,
          file: v.filename,
        })
      } else if (v.height && v.width && v.content_type?.startsWith('video/')) {
        return segment('video', {
          url: v.url,
          proxy_url: v.proxy_url,
          file: v.filename,
        })
      } else if (v.content_type?.startsWith('audio/')) {
        return segment('record', {
          url: v.url,
          proxy_url: v.proxy_url,
          file: v.filename,
        })
      } else {
        return segment('file', {
          url: v.url,
          proxy_url: v.proxy_url,
          file: v.filename,
        })
      }
    }).join('')
  }
  for (const embed of meta.embeds) {
    // not using embed types
    // https://discord.com/developers/docs/resources/channel#embed-object-embed-types
    if (embed.image) {
      session.content += segment('image', { url: embed.image.url, proxy_url: embed.image.proxy_url })
    }
    if (embed.thumbnail) {
      session.content += segment('image', { url: embed.thumbnail.url, proxy_url: embed.thumbnail.proxy_url })
    }
    if (embed.video) {
      session.content += segment('video', { url: embed.video.url, proxy_url: embed.video.proxy_url })
    }
  }
  return session as MessageInfo
}

function adaptMessageSession(bot: DiscordBot, meta: DC.Message, session: Partial<Session> = {}) {
  adaptMessage(bot, meta, session)
  session.messageId = meta.id
  session.timestamp = new Date(meta.timestamp).valueOf() || Date.now()
  // 遇到过 cross post 的消息在这里不会传消息 id
  if (meta.message_reference) {
    const { message_id, channel_id } = meta.message_reference
    session.content = segment('quote', { id: message_id, channelId: channel_id }) + session.content
  }
  return session
}

function prepareMessageSession(session: Partial<Session>, data: DC.Message) {
  session.groupId = data.guild_id
  session.subtype = data.guild_id ? 'group' : 'private'
  session.channelId = data.channel_id
}

function prepareReactionSession(session: Partial<Session>, data: any) {
  session.userId = data.user_id
  session.messageId = data.message_id
  session.groupId = data.guild_id
  session.channelId = data.channel_id
  session.subtype = data.guild_id ? 'group' : 'private'
  if (!data.emoji) return
  const { id, name } = data.emoji
  session.content = id ? `${name}:${id}` : name
}

export async function adaptSession(bot: DiscordBot, input: DC.Payload) {
  const session: Partial<Session> = {
    selfId: bot.selfId,
    platform: 'discord',
  }
  if (input.t === 'MESSAGE_CREATE') {
    session.type = 'message'
    prepareMessageSession(session, input.d)
    adaptMessageSession(bot, input.d, session)
    // dc 情况特殊 可能有 embeds 但是没有消息主体
    // if (!session.content) return
    if (session.userId === bot.selfId) return
  } else if (input.t === 'MESSAGE_UPDATE') {
    session.type = 'message-updated'
    prepareMessageSession(session, input.d)
    const msg = await bot.$getMessage(input.d.channel_id, input.d.id)
    // Unlike creates, message updates may contain only a subset of the full message object payload
    // https://discord.com/developers/docs/topics/gateway#message-update
    adaptMessageSession(bot, msg, session)
    // if (!session.content) return
    if (session.userId === bot.selfId) return
  } else if (input.t === 'MESSAGE_DELETE') {
    session.type = 'message-deleted'
    session.messageId = input.d.id
    prepareMessageSession(session, input.d)
  } else if (input.t === 'MESSAGE_REACTION_ADD') {
    session.type = 'reaction-added'
    prepareReactionSession(session, input.d)
  } else if (input.t === 'MESSAGE_REACTION_REMOVE') {
    session.type = 'reaction-deleted'
    session.subtype = 'one'
    prepareReactionSession(session, input.d)
  } else if (input.t === 'MESSAGE_REACTION_REMOVE_ALL') {
    session.type = 'reaction-deleted'
    session.subtype = 'all'
    prepareReactionSession(session, input.d)
  } else if (input.t === 'MESSAGE_REACTION_REMOVE_EMOJI') {
    session.type = 'reaction-deleted'
    session.subtype = 'emoji'
    prepareReactionSession(session, input.d)
  } else {
    return
  }
  return new Session(bot.app, session)
}
