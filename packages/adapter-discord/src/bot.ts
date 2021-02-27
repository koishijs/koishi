/* eslint-disable camelcase */

import axios, { Method } from 'axios'
import { Bot, MessageInfo } from 'koishi-core'
import * as DC from './types'
import { ExecuteWebhookBody, GuildMember, DiscordMessage, PartialGuild, DiscordUser, DiscordChannel } from './types'
import { adaptChannel, adaptGroup, adaptMessage, adaptUser } from './utils'
import { segment } from 'koishi-utils'
import FormData from 'form-data'
import { TelegramResponse } from 'koishi-adapter-telegram'

const fs = require('fs')
declare module 'koishi-core' {
  namespace Bot {
    interface Platforms {
      discord: DiscordBot
    }
  }
}

export interface DiscordBot {
  executeWebhook(id: string, token: string, data: ExecuteWebhookBody): Promise<any>
}

export class DiscordBot extends Bot<'discord'> {
  _d = 0
  version = 'discord'
  _ping: NodeJS.Timeout

  async request<T = any>(method: Method, path: string, data?: any): Promise<T> {
    const url = `https://discord.com/api/v8${path}`
    const headers: Record<string, any> = {
      Authorization: `Bot ${this.token}`,
    }
    const response = await axios({
      method,
      url,
      headers,
      data,
    })
    return response.data
  }

  async getSelf() {
    const data = await this.request<DC.DiscordUser>('GET', '/users/@me')
    return adaptUser(data)
  }

  private async sendEmbedMessage(channelId: string, filePath: string, payload_json: Record<string, any> = {}) {
    const fd = new FormData()
    fd.append('file', fs.createReadStream(filePath))
    fd.append('payload_json', JSON.stringify(payload_json))
    const headers: Record<string, any> = {
      Authorization: `Bot ${this.token}`,
    }
    const response = await axios({
      method: 'post',
      url: `https://discord.com/api/v8/channels/${channelId}/messages`,
      headers: { ...headers, ...fd.getHeaders() },
      data: fd,
    })
    return response.data
  }

  private parseQuote(chain: segment.Chain) {
    if (chain[0].type !== 'quote') return
    return chain.shift().data.id
  }

  async sendPrivateMessage(channelId: string, content: string) {
    return this.sendMessage(channelId, content)
  }

  async sendMessage(channelId: string, content: string) {
    const session = this.createSession({ channelId, content })
    if (await this.app.serial(session, 'before-send', session)) return

    const chain = segment.parse(session.content)
    const quote = this.parseQuote(chain)
    const message_reference = quote ? {
      message_id: quote,
    } : undefined

    let sentMessageId = '0'
    for (const code of chain) {
      const { type, data } = code
      if (type === 'text') {
        const r = await this.request('POST', `/channels/${channelId}/messages`, {
          content: data.content,
          message_reference,
        })
        sentMessageId = r.id
      } else if (type === 'image') {
        if (data.url.startsWith('http://') || data.url.startsWith('https://')) {
          const r = await this.request('POST', `/channels/${channelId}/messages`, {
            embed: {
              url: data.url,
              message_reference,
            },
          })
          sentMessageId = r.id
        } else {
          const r = await this.sendEmbedMessage(channelId, data.url, {
            message_reference,
          })
          sentMessageId = r.id
        }
      }
    }

    this.app.emit(session, 'send', session)
    return session.messageId = sentMessageId
  }

  async deleteMessage(channelId: string, messageId: string) {
    return this.request('DELETE', `/channels/${channelId}/messages/${messageId}`)
  }

  async editMessage(channelId: string, messageId: string, content: string) {
    // @TODO 好像embed会出问题
    return this.request('PATCH', `/channels/${channelId}/messages/${messageId}`, {
      content,
    })
  }

  async getMessageFromServer(channelId: string, messageId: string) {
    return this.request<DiscordMessage>('GET', `/channels/${channelId}/messages/${messageId}`)
  }

  async getMessage(channelId: string, messageId: string): Promise<MessageInfo> {
    const msg = await this.getMessageFromServer(channelId, messageId)
    const result: MessageInfo = {
      messageId: msg.id,
      channelId: msg.channel_id,
      groupId: msg.guild_id,
      userId: msg.author.id,
      content: msg.content,
      timestamp: new Date(msg.timestamp).valueOf(),
      author: adaptUser(msg.author),
    }
    if (msg.message_reference) {
      const quoteMsg = await this.getMessageFromServer(msg.message_reference.channel_id, msg.message_reference.message_id)
      result.quote = await adaptMessage(this, quoteMsg)
    }
    return result
  }

  async getUser(userId: string) {
    const data = await this.request<DiscordUser>('GET', `/users/${userId}`)
    return adaptUser(data)
  }

  async getGroupList() {
    const data = await this.request<PartialGuild[]>('GET', '/users/@me/guilds')
    return data.map(adaptGroup)
  }

  async getGroupMemberList(guildId: string) {
    const data = await this.request<GuildMember[]>('GET', `/guilds/${guildId}/members`)
    return data.map(v => adaptUser(v.user))
  }

  async getChannel(channelId: string) {
    const data = await this.request<DiscordChannel>('GET', `/channels/${channelId}`)
    return adaptChannel(data)
  }

  async executeWebhook(id: string, token: string, data: ExecuteWebhookBody) {
    return this.request('POST', `/webhooks/${id}/${token}`, data)
  }
}
