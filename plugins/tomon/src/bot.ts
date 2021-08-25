import { Bot, MessageInfo, GuildInfo, UserInfo, GuildMemberInfo, AuthorInfo } from 'koishi'
import { Method } from 'axios'
import { Route, RequestOptions } from './network/route'
import WebSocket from 'ws'

export interface TomonAuthor extends AuthorInfo {
  id: string
  username: string
  discriminator: string
  avatar: string
  name: string
  type: number
}

export interface Channel {
  id: string
  type: number
  name: string
  guildId: string
  position: number
  permissionOverwrites: any[]
  parentId: string
  topic: string
  lastMessageId: string
  lastPinTimestamp: string
  defaultMessageNotifications: number
}

export interface TomonMessageInfo extends MessageInfo {
  id: string
  channelId: string
  guildId: string
  author: TomonAuthor
  member?: TomonGroupMemberInfo
  nonce: string
  attachments: string[]
  reactions: string[]
  mentions: string[]
  stamps: string[]
  pinned: boolean
  editedTimestamp: number
}

export interface TomonGroupInfo extends GuildInfo {
  description: string
  icon: string
  iconUrl: string
  background: string
  backgroundUrl: string
  backgroundProps: string
  ownerId: string
  joinedAt: number
  position: number
  defaultMessageNotifications: number
  systemChannelFlags: number
  systemChannelId: string
  banned: boolean
  updatedAt: number
}

export interface TomonUserInfo extends UserInfo {
  avatar?: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface TomonGroupMemberInfo extends TomonUserInfo, GuildMemberInfo {
  joinedAt: number
  mute: boolean
  deaf: boolean
}

export class TomonBot extends Bot<'tomon'> {
  id: string
  username: string
  discriminator: string
  avatar: string
  name: string
  avatarUrl: string
  createdAt: string
  updatedAt: string
  email: string
  emailVerified: boolean
  phone: string
  phoneVerified: boolean
  banned: boolean
  socket: WebSocket

  static toMessage(data: TomonMessageInfo) {
    data.timestamp = +new Date(data.timestamp)
    if (data.member) TomonBot.toGroupMember(data.member)
  }

  static toGroup(data: TomonGroupInfo) {
    data.updatedAt = +new Date(data.updatedAt)
  }

  static toUser(data: TomonUserInfo) {
    data.createdAt = +new Date(data.createdAt)
    data.updatedAt = +new Date(data.updatedAt)
  }

  static toGroupMember(data: TomonGroupMemberInfo) {
    TomonBot.toUser(data)
    data.joinedAt = +new Date(data.joinedAt)
  }

  request<T = any>(method: Method, path: string, options?: RequestOptions): Promise<T> {
    return new Route(path, 'https://beta.tomon.co/api/v1', this.token).request(method, options)
  }

  async sendMessage(channelId: string, content: string) {
    return this.request('POST', `/channels/${channelId}/messages`, { data: { content } })
  }

  async sendPrivateMessage(userId: string, content: string) {
    const channel = await this.request<Channel>('POST', '/users/@me/channels', { data: { recipients: [userId] } })
    return this.sendMessage(channel.id, content)
  }

  async getMessage(channelId: string, messageId: string) {
    const data = await this.request('GET', `/channels/${channelId}/messages/${messageId}`)
    TomonBot.toMessage(data)
    return data
  }

  async editMessage(channelId: string, messageId: string, content: string) {
    await this.request('PATCH', `/channels/${channelId}/messages/${messageId}`, { data: { content } })
  }

  async deleteMessage(channelId: string, messageId: string) {
    await this.request('DELETE', `/channels/${channelId}/messages/${messageId}`)
  }

  async getMessageList(channelId: string, limit?: number): Promise<TomonMessageInfo[]> {
    const data = await this.request('GET', `/channels/${channelId}/messages`, { data: { channelId, limit } })
    data.forEach(TomonBot.toMessage)
    return data
  }

  async getGuild(guildId: string): Promise<TomonGroupInfo> {
    const data = await this.request('GET', `/guilds/${guildId}`)
    TomonBot.toGroup(data)
    return data
  }

  async getGuildList(): Promise<TomonGroupInfo[]> {
    const data = await this.request('GET', '/users/@me/guilds')
    data.forEach(TomonBot.toGroup)
    return data
  }

  async getGuildMember(guildId: string, userId: string): Promise<TomonGroupMemberInfo> {
    const data = await this.request('GET', `/guilds/${guildId}/members/${userId}`)
    TomonBot.toGroupMember(data)
    return data
  }

  async getGuildMemberList(guildId: string): Promise<TomonGroupMemberInfo[]> {
    const data = await this.request('GET', `/guilds/${guildId}/members`)
    data.forEach(TomonBot.toGroupMember)
    return data
  }

  getUser() {
    return Promise.reject(new Error('not implemented'))
  }
}
