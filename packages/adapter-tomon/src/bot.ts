import { Bot, MessageInfo } from 'koishi-core'
import { camelize } from 'koishi-utils'
import Route from './network/route'
import WebSocket from 'ws'

declare module 'koishi-core/dist/database' {
  interface Platforms {
    tomon: TomonBot
  }
}

export interface Author {
  id: string;
  username: string;
  discriminator: string;
  avatar: string;
  name: string;
  avatarUrl: string;
  type: number;
}

export interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar: string;
  name: string;
  avatarUrl: string;
  createdAt: Date;
  updatedAt: Date;
  type: number;
}

export interface Member {
  user: User;
  guildId: string;
  nick: string;
  joinedAt: string;
  mute: boolean;
  deaf: boolean;
  roles: string[];
}

export interface Guild {
  id: string;
  name: string;
  icon: string;
  iconUrl: string;
  background: string;
  backgroundUrl: string;
  backgroundProps: string;
  description: string;
  ownerId: string;
  joinedAt: string;
  position: number;
  defaultMessageNotifications: number;
  systemChannelFlags: number;
  systemChannelId: string;
  banned: boolean;
  updatedAt: string;
}

export interface Channel {
  id: string;
  type: number;
  name: string;
  guildId: string;
  position: number;
  permissionOverwrites: any[];
  parentId: string;
  topic: string;
  lastMessageId: string;
  lastPinTimestamp: string;
  defaultMessageNotifications: number;
}

export interface TomonMessageInfo extends MessageInfo {
  id: string
  channelId: string
  guildId: string
  author: Author
  member?: Member
  nonce: string
  attachments: string[]
  reactions: string[]
  mentions: string[]
  stamps: string[]
  pinned: boolean
  editedTimestamp: number
}

function adaptMessage(data: TomonMessageInfo) {
  data = camelize(data)
  data.timestamp = +new Date(data.timestamp)
  return data
}

export class TomonBot extends Bot {
  id: string
  username: string
  discriminator: string
  avatar: string
  name: string
  avatarUrl: string
  createdAt: string
  updatedAt: string
  // type: number
  email: string
  emailVerified: boolean
  phone: string
  phoneVerified: boolean
  banned: boolean
  socket: WebSocket

  route(path: string): Route {
    return new Route(path, 'https://beta.tomon.co/api/v1', this.token)
  }

  async sendMessage(channelId: string, content: string) {
    return this.route(`/channels/${channelId}/messages`).post({ data: { content } })
  }

  async getMessage(channelId: string, messageId: string) {
    const data = await this.route(`/channels/${channelId}/messages/${messageId}`).get()
    return adaptMessage(data)
  }

  async editMessage(channelId: string, messageId: string, content: string) {
    await this.route(`/channels/${channelId}/messages/${messageId}`).patch({ data: { content } })
  }

  async deleteMessage(channelId: string, messageId: string) {
    await this.route(`/channels/${channelId}/messages/${messageId}`).delete()
  }

  async getMessages(channelId: string, limit?: number) {
    const data: any[] = await this.route(`/channels/${channelId}/messages`).get({ data: { channel_id: channelId, limit } })
    return data.map(adaptMessage)
  }
}
