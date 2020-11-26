import { Bot, MessageInfo } from 'koishi-core'
import { camelize } from 'koishi-utils'
import { Author } from 'tomon-sdk/lib/types'
import Route from './network/route'
import WebSocket from 'ws'

declare module 'koishi-core/dist/database' {
  interface Platforms {
    tomon: TomonBot
  }
}

export interface TomonMessageInfo extends MessageInfo {
  id: string
  channelId: string
  author: Author
  type: number
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
  data.timestamp = +data.timestamp // TODO: check
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
