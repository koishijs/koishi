import { AuthorInfo, ChannelInfo, GroupInfo, MessageInfo, segment, Session, UserInfo } from 'koishi-core'
import { DiscordBot } from './bot'
import * as DC from './types'

export const adaptUser = (user: DC.DiscordUser): UserInfo => ({
  userId: user.id,
  avatar: user.avatar,
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

export async function adaptMessage(bot: DiscordBot, meta: DC.Message, session: Partial<Session.Payload<Session.MessageAction>> = {}) {
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
      .replace(/<@[!&](.+?)>/, (_, id) => {
        if (meta.mention_roles.includes(id)) {
          return segment('at', { role: id })
        } else {
          return segment('at', { id })
        }
      })
      .replace(/<:(.*):(.+?)>/, (_, name, id) => segment('face', { id: id, name }))
      .replace(/<a:(.*):(.+?)>/, (_, name, id) => segment('face', { id: id, name, animated: true }))
      .replace(/@everyone/, () => segment('at', { type: 'all' }))
      .replace(/@here/, () => segment('at', { type: 'here' }))
      .replace(/<#(.+?)>/, (_, id) => segment.sharp(id))
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
      } else {
        return segment('file', {
          url: v.url,
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
  return session
}

async function adaptMessageSession(bot: DiscordBot, meta: DC.Message, session: Partial<Session.Payload<Session.MessageAction>> = {}) {
  await adaptMessage(bot, meta, session)
  session.messageId = meta.id
  session.timestamp = new Date(meta.timestamp).valueOf() || new Date().valueOf()
  session.subtype = meta.guild_id ? 'group' : 'private'
  // 遇到过 cross post 的消息在这里不会传消息id
  // 别的 guild 传来的可能没有权限 在这同意忽略
  // eslint-disable-next-line camelcase
  if (meta.message_reference?.message_id && meta.message_reference?.guild_id === meta.guild_id) {
    const msg = await bot.$getMessage(meta.message_reference.channel_id, meta.message_reference.message_id)
    session.quote = await adaptMessage(bot, msg)
    session.quote.messageId = meta.message_reference.message_id
    session.quote.channelId = meta.message_reference.channel_id
  }
  return session
}

async function adaptMessageCreate(bot: DiscordBot, meta: DC.Message, session: Partial<Session.Payload<Session.MessageAction>>) {
  session.groupId = meta.guild_id
  session.subtype = meta.guild_id ? 'group' : 'private'
  session.channelId = meta.channel_id
  await adaptMessageSession(bot, meta, session)
}

export async function adaptSession(bot: DiscordBot, input: DC.Payload) {
  const session: Partial<Session.Payload<Session.MessageAction>> = {
    selfId: bot.selfId,
    platform: 'discord',
  }
  if (input.t === 'MESSAGE_CREATE') {
    session.type = 'message'
    await adaptMessageCreate(bot, input.d as DC.Message, session)
    // dc 情况特殊 可能有 embeds 但是没有消息主体
    // if (!session.content) return
    if (session.userId === bot.selfId) return
  } else if (input.t === 'MESSAGE_UPDATE') {
    session.type = 'message-updated'
    const d = input.d as DC.Message
    const msg = await bot.$getMessage(d.channel_id, d.id)
    // Unlike creates, message updates may contain only a subset of the full message object payload
    // https://discord.com/developers/docs/topics/gateway#message-update
    await adaptMessageCreate(bot, msg, session)
    // if (!session.content) return
    if (session.userId === bot.selfId) return
  } else if (input.t === 'MESSAGE_DELETE') {
    session.type = 'message-deleted'
    session.messageId = input.d.id
  }
  session.discord = {
    raw: input.d,
  }
  return new Session(bot.app, session)
}
