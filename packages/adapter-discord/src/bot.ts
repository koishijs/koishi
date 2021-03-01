/* eslint-disable camelcase */

import axios, { Method } from 'axios'
import { Bot, MessageInfo } from 'koishi-core'
import * as DC from './types'
import { ExecuteWebhookBody, GuildMember, DiscordMessage, PartialGuild, DiscordUser, DiscordChannel } from './types'
import { adaptChannel, adaptGroup, adaptMessage, adaptUser } from './utils'
import { createReadStream } from 'fs'
import { segment } from 'koishi-utils'
import FormData from 'form-data'

export interface DiscordBot {
  executeWebhook(id: string, token: string, data: ExecuteWebhookBody): Promise<any>
}

export class DiscordBot extends Bot<'discord'> {
  _d = 0
  version = 'discord'
  _ping: NodeJS.Timeout
  _sessionId: string = ''

  async request<T = any>(method: Method, path: string, data?: any): Promise<T> {
    const { axiosConfig, discord } = this.app.options
    const url = `https://discord.com/api/v8${path}`
    const headers: Record<string, any> = {
      Authorization: `Bot ${this.token}`,
    }
    const response = await axios({
      ...axiosConfig,
      ...discord.axiosConfig,
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

  private async sendEmbedMessage(requestUrl: string, filePath: string, payload_json: Record<string, any> = {}) {
    const fd = new FormData()
    fd.append('file', createReadStream(filePath))
    fd.append('payload_json', JSON.stringify(payload_json))
    const headers: Record<string, any> = {
      Authorization: `Bot ${this.token}`,
    }
    const response = await axios({
      method: 'post',
      url: 'https://discord.com/api/v8' + requestUrl,
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

  private async sendFullMessage(requestUrl: string, content: string, addition: Record<string, any> = {}): Promise<string> {
    const chain = segment.parse(content)
    let sentMessageId = '0'
    let needSend = ''
    const isWebhook = requestUrl.startsWith('/webhooks/')
    const that = this
    async function sendMessage() {
      const r = await that.request('POST', requestUrl, {
        content: needSend,
        ...addition,
      })
      sentMessageId = r.id
      needSend = ''
    }
    for (const code of chain) {
      const { type, data } = code
      if (type === 'text') {
        needSend += data.content
      } else if (type === 'at' && data.id) {
        needSend += `<@${data.id}>`
      } else if (type === 'at' && data.type === 'all') {
        needSend += `@everyone`
      } else if (type === 'at' && data.type === 'here') {
        needSend += `@here`
      } else if (type === 'sharp' && data.id) {
        needSend += `<#${data.id}>`
      } else if (type === 'face' && data.name && data.id) {
        needSend += `<:${data.name}:${data.id}>`
      } else {
        if (needSend) await sendMessage()
        if (type === 'share') {
          const sendData = isWebhook ? {
            embeds: [{ ...addition, ...data }],
          } : {
            embed: { ...addition, ...data },
          }
          const r = await this.request('POST', requestUrl, {
            ...sendData,
          })
          sentMessageId = r.id
        }
        if (type === 'image' || type === 'video') {
          if (data.url.startsWith('http://') || data.url.startsWith('https://')) {
            const sendData = isWebhook ? {
              embeds: [{ ...addition, ...data }],
            } : {
              embed: { ...addition, ...data },
            }
            const r = await this.request('POST', requestUrl, {
              ...sendData,
            })
            sentMessageId = r.id
          } else {
            const r = await this.sendEmbedMessage(requestUrl, data.url, {
              ...addition,
            })
            sentMessageId = r.id
          }
        }
      }
    }
    if (needSend) await sendMessage()
    return sentMessageId
  }

  async sendMessage(channelId: string, content: string) {
    const session = this.createSession({ channelId, content })
    if (await this.app.serial(session, 'before-send', session)) return

    const chain = segment.parse(session.content)
    const quote = this.parseQuote(chain)
    const message_reference = quote ? {
      message_id: quote,
    } : undefined

    const sentMessageId = await this.sendFullMessage(`/channels/${channelId}/messages`, session.content, { message_reference })

    this.app.emit(session, 'send', session)
    return session.messageId = sentMessageId
  }

  async deleteMessage(channelId: string, messageId: string) {
    return this.request('DELETE', `/channels/${channelId}/messages/${messageId}`)
  }

  async editMessage(channelId: string, messageId: string, content: string) {
    const chain = segment.parse(content)
    const image = chain.find(v => v.type === 'image')
    if (image) {
      throw new Error("You can't include embed object(s) while editing message.")
    }
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
    const chain = segment.parse(data.content)
    if (chain.filter(v => v.type === 'image').length > 10) {
      throw new Error('Up to 10 embed objects')
    }

    const sentMessageId = await this.sendFullMessage(`/webhooks/${id}/${token}`, data.content)

    return sentMessageId
  }
}
