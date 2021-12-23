import { Adapter, Bot, Session, paramCase, segment, Schema, App, defineProperty } from 'koishi'
import * as qface from 'qface'
import { OneBotBot } from './bot'
import * as OneBot from './types'

export * from './types'

export interface AdapterConfig extends Adapter.WebSocketClient.Config, App.Config.Request {
  path?: string
  secret?: string
  responseTimeout?: number
}

export const AdapterConfig: Schema<AdapterConfig> = Schema.intersect([
  Schema.object({
    path: Schema.string().description('服务器监听的路径，用于 http 和 ws-reverse 协议。').default('/onebot'),
    secret: Schema.string().description('接收事件推送时用于验证的字段，应该与 OneBot 的 secret 配置保持一致。'),
  }),
  Adapter.WebSocketClient.Config,
  App.Config.Request,
])

export const adaptUser = (user: OneBot.AccountInfo): Bot.User => ({
  userId: user.user_id.toString(),
  avatar: `http://q.qlogo.cn/headimg_dl?dst_uin=${user.user_id}&spec=640`,
  username: user.nickname,
})

export const adaptGuildMember = (user: OneBot.SenderInfo): Bot.GuildMember => ({
  ...adaptUser(user),
  nickname: user.card,
  roles: [user.role],
})

export const adapterQQGuildMember = (user: OneBot.GuildMemberInfo, presetRole?: string): Bot.GuildMember => ({
  userId: user.tiny_id.toString(),
  username: user.nickname,
  nickname: user.nickname,
  roles: [...(presetRole ? [presetRole] : []), user.role.toString()],
  isBot: presetRole === 'bot',
})

export const adaptAuthor = (user: OneBot.SenderInfo, anonymous?: OneBot.AnonymousInfo): Bot.Author => ({
  ...adaptUser(user),
  nickname: anonymous?.name || user.card,
  anonymous: anonymous?.flag,
  roles: [user.role],
})

export function adaptMessage(message: OneBot.Message, bot?: OneBotBot): Bot.Message {
  const author = adaptAuthor(message.sender, message.anonymous)
  const result: Bot.Message = {
    author,
    userId: author.userId,
    messageId: message.message_id.toString(),
    timestamp: message.time * 1000,
    content: segment.transform(message.message, {
      at({ qq }) {
        if (bot?.isGuildServiceAvailable() && qq === bot.guildProfile.userId) {
          return segment.at(bot.selfId)
        }
        if (qq !== 'all') return segment.at(qq)
        return segment('at', { type: 'all' })
      },
      face: ({ id }) => segment('face', { id, url: qface.getUrl(id) }),
      reply: (data) => segment('quote', data),
    }),
  }
  if (message.guild_id) {
    result.guildId = message.guild_id.toString()
    result.channelId = message.channel_id.toString()
  } else if (message.group_id) {
    result.guildId = result.channelId = message.group_id.toString()
  } else {
    result.channelId = 'private:' + author.userId
  }
  return result
}

export const adaptGuild = (info: OneBot.GroupInfo | OneBot.GuildBaseInfo): Bot.Guild => {
  if ((info as OneBot.GuildBaseInfo).guild_id) {
    const guild = info as OneBot.GuildBaseInfo
    return {
      guildId: guild.guild_id.toString(),
      guildName: guild.guild_name,
    }
  } else {
    const group = info as OneBot.GroupInfo
    return {
      guildId: group.group_id.toString(),
      guildName: group.group_name,
    }
  }
}

export const adaptChannel = (info: OneBot.GroupInfo | OneBot.ChannelInfo): Bot.Channel => {
  if ((info as OneBot.ChannelInfo).channel_id) {
    const channel = info as OneBot.ChannelInfo
    return {
      channelId: channel.channel_id.toString(),
      channelName: channel.channel_name,
    }
  } else {
    const group = info as OneBot.GroupInfo
    return {
      channelId: group.group_id.toString(),
      channelName: group.group_name,
    }
  }
}

export function dispatchSession(bot: OneBotBot, data: OneBot.Payload) {
  const payload = adaptSession(data, bot)
  if (!payload) return
  const session = new Session(bot, payload)
  defineProperty(session, 'onebot', Object.create(bot.internal))
  Object.assign(session.onebot, data)
  bot.adapter.dispatch(session)
}

export function adaptSession(data: OneBot.Payload, bot?: OneBotBot) {
  const session: Partial<Session> = {}
  session.selfId = '' + data.self_id
  session.type = data.post_type as any
  session.subtype = data.sub_type as any

  if (data.post_type === 'message') {
    Object.assign(session, adaptMessage(data, bot))
    session.subtype = data.message_type
    return session
  }

  if (data.user_id) session.userId = '' + data.user_id
  if (data.group_id) session.guildId = session.channelId = '' + data.group_id
  if (data.guild_id) session.guildId = '' + data.guild_id
  if (data.channel_id) session.channelId = '' + data.channel_id
  if (data.target_id) session.targetId = '' + data.target_id
  if (data.operator_id) session.operatorId = '' + data.operator_id
  if (data.message_id) session.messageId = '' + data.message_id

  if (data.post_type === 'request') {
    session.content = data.comment
    session.messageId = data.flag
    if (data.request_type === 'friend') {
      session.type = 'friend-request'
      session.channelId = `private:${session.userId}`
    } else if (data.sub_type === 'add') {
      session.type = 'guild-member-request'
    } else {
      session.type = 'guild-request'
    }
  } else if (data.post_type === 'notice') {
    switch (data.notice_type) {
      case 'group_recall':
        session.type = 'message-deleted'
        session.subtype = 'group'
        break
      case 'friend_recall':
        session.type = 'message-deleted'
        session.subtype = 'private'
        session.channelId = `private:${session.userId}`
        break
      case 'friend_add':
        session.type = 'friend-added'
        break
      case 'group_upload':
        session.type = 'group-file-added'
        break
      case 'group_admin':
        session.type = 'group-member'
        session.subtype = 'role'
        break
      case 'group_ban':
        session.type = 'group-member'
        session.subtype = 'ban'
        break
      case 'group_decrease':
        session.type = session.userId === session.selfId ? 'group-deleted' : 'group-member-deleted'
        session.subtype = session.userId === session.operatorId ? 'active' : 'passive'
        break
      case 'group_increase':
        session.type = session.userId === session.selfId ? 'group-added' : 'group-member-added'
        session.subtype = session.userId === session.operatorId ? 'active' : 'passive'
        break
      case 'group_card':
        session.type = 'group-member'
        session.subtype = 'nickname'
        break
      case 'notify':
        session.type = 'notice'
        session.subtype = paramCase(data.sub_type) as any
        if (session.subtype === 'poke') {
          session.channelId ||= `private:${session.userId}`
        } else if (session.subtype === 'honor') {
          session.subsubtype = paramCase(data.honor_type) as any
        }
        break
      case 'message_reactions_updated':
        session.type = 'onebot'
        session.subtype = 'message-reactions-updated'
      case 'channel_created':
        session.type = 'onebot'
        session.subtype = 'channel-created'
      case 'channel_updated':
        session.type = 'onebot'
        session.subtype = 'channel-updated'
      case 'channel_destroyed':
        session.type = 'onebot'
        session.subtype = 'channel-destroyed'
    }
  } else return

  return session
}

export async function runIfFailBlank<T>(fun: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fun()
  } catch (e) {
    return []
  }
}
