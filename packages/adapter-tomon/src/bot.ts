import { Bot, MessageInfo } from 'koishi-core'
import { camelize } from 'koishi-utils'
import { Author } from 'tomon-sdk/lib/types'
import Tomon from 'tomon-sdk'

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
  tomon?: Tomon

  async sendMessage(channelId: string, content: string) {
    return this.tomon.api.route(`/channels/${channelId}/messages`).post({ data: { content } })
  }

  async getMessage(channelId: string, messageId: string) {
    const data = await this.tomon.api.route(`/channels/${channelId}/messages/${messageId}`).get()
    return adaptMessage(data)
  }

  async editMessage(channelId: string, messageId: string, content: string) {
    await this.tomon.api.route(`/channels/${channelId}/messages/${messageId}`).patch({ data: { content } })
  }

  async deleteMessage(channelId: string, messageId: string) {
    await this.tomon.api.route(`/channels/${channelId}/messages/${messageId}`).delete()
  }

  async getMessages(channelId: string, limit?: number) {
    const data: any[] = await this.tomon.api.route(`/channels/${channelId}/messages`).get({ data: { channel_id: channelId, limit } })
    return data.map(adaptMessage)
  }
}
