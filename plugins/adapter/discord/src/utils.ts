import { Adapter, Bot, Schema, segment, Session } from 'koishi'
import { Sender } from './sender'
import { DiscordBot } from './bot'
import * as DC from './types'

export interface AdapterConfig extends Sender.Config, Adapter.WebSocketClient.Config {}

export const AdapterConfig: Schema<AdapterConfig> = Schema.intersect([
  Sender.Config,
  Adapter.WebSocketClient.Config,
])

export const adaptUser = (user: DC.User): Bot.User => ({
  userId: user.id,
  avatar: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
  username: user.username,
  discriminator: user.discriminator,
  isBot: user.bot || false,
})

export function adaptGroup(data: DC.Guild): Bot.Guild {
  return {
    guildId: data.id,
    guildName: data.name,
  }
}

export function adaptChannel(data: DC.Channel): Bot.Channel {
  return {
    channelId: data.id,
    channelName: data.name,
  }
}

export const adaptAuthor = (author: DC.User): Bot.Author => ({
  ...adaptUser(author),
  nickname: author.username,
})

export function adaptMessage(meta: DC.Message, session: Partial<Session> = {}) {
  if (meta.author) {
    session.author = adaptAuthor(meta.author)
    session.userId = meta.author.id
  }
  if (meta.member?.nick) {
    session.author.nickname = meta.member?.nick
  }

  // https://discord.com/developers/docs/reference#message-formatting
  session.content = ''
  if (meta.content) {
    session.content = meta.content
      .replace(/<@[!&]?(.+?)>/g, (_, id) => {
        if (meta.mention_roles.includes(id)) {
          return segment('at', { role: id })
        } else {
          const user = meta.mentions?.find(u => u.id === id || `${u.username}#${u.discriminator}` === id)
          return segment.at(id, { name: user?.username })
        }
      })
      .replace(/<:(.*):(.+?)>/g, (_, name, id) => segment('face', { id: id, name }))
      .replace(/<a:(.*):(.+?)>/g, (_, name, id) => segment('face', { id: id, name, animated: true }))
      .replace(/@everyone/g, () => segment('at', { type: 'all' }))
      .replace(/@here/g, () => segment('at', { type: 'here' }))
      .replace(/<#(.+?)>/g, (_, id) => {
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
  return session as Bot.Message
}

export function adaptMessageSession(meta: DC.Message, session: Partial<Session> = {}) {
  adaptMessage(meta, session)
  session.messageId = meta.id
  session.timestamp = new Date(meta.timestamp).valueOf() || Date.now()
  // 遇到过 cross post 的消息在这里不会传消息 id
  if (meta.message_reference) {
    const { message_id, channel_id } = meta.message_reference
    session.content = segment('quote', { id: message_id, channelId: channel_id }) + session.content
  }
  return session
}

export function prepareMessageSession(session: Partial<Session>, data: Partial<DC.Message>) {
  session.guildId = data.guild_id
  session.subtype = data.guild_id ? 'group' : 'private'
  session.channelId = data.channel_id
}

function prepareReactionSession(session: Partial<Session>, data: any) {
  session.userId = data.user_id
  session.messageId = data.message_id
  session.guildId = data.guild_id
  session.channelId = data.channel_id
  session.subtype = data.guild_id ? 'group' : 'private'
  if (!data.emoji) return
  const { id, name } = data.emoji
  session.content = id ? `${name}:${id}` : name
}

export async function adaptSession(bot: DiscordBot, input: DC.GatewayPayload) {
  const session: Partial<Session> = {
    selfId: bot.selfId,
  }
  if (input.t === 'MESSAGE_CREATE') {
    session.type = 'message'
    prepareMessageSession(session, input.d)
    adaptMessageSession(input.d, session)
    // dc 情况特殊 可能有 embeds 但是没有消息主体
    // if (!session.content) return
  } else if (input.t === 'MESSAGE_UPDATE') {
    session.type = 'message-updated'
    prepareMessageSession(session, input.d)
    const msg = await bot.internal.getChannelMessage(input.d.channel_id, input.d.id)
    // Unlike creates, message updates may contain only a subset of the full message object payload
    // https://discord.com/developers/docs/topics/gateway#message-update
    adaptMessageSession(msg, session)
    // if (!session.content) return
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
  } else if (input.t === 'CHANNEL_UPDATE') {
    session.type = 'channel-updated'
    session.guildId = input.d.guild_id
    session.subtype = input.d.guild_id ? 'group' : 'private'
    session.channelId = input.d.id
  } else {
    return
  }
  return new Session(bot, session)
}
