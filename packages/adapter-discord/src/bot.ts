/* eslint-disable camelcase */

import axios, { Method } from 'axios'
import { Bot, MessageInfo } from 'koishi-core'
import * as DC from './types'
import {
  Channel,
  DiscordChannel,
  DiscordMessage,
  DiscordUser,
  ExecuteWebhookBody,
  GuildBody,
  GuildMember,
  GuildRoleBody,
  PartialGuild,
  Role,
  Webhook,
} from './types'
import { adaptChannel, adaptGroup, adaptMessage, adaptUser } from './utils'
import { readFileSync } from 'fs'
import { segment } from 'koishi-utils'
import FormData from 'form-data'
import FileType from 'file-type'

export class DiscordBot extends Bot<'discord'> {
  _d = 0
  version = 'discord'
  _ping: NodeJS.Timeout
  _sessionId: string = ''

  async request<T = any>(method: Method, path: string, data?: any, exHeaders?: any): Promise<T> {
    const { axiosConfig, discord = {} } = this.app.options
    const url = `https://discord.com/api/v8${path}`
    const headers: Record<string, any> = {
      Authorization: `Bot ${this.token}`,
    }
    const response = await axios({
      ...axiosConfig,
      ...discord.axiosConfig,
      method,
      url,
      headers: { ...headers, ...exHeaders },
      data,
    })
    return response.data
  }

  async getSelf() {
    const data = await this.request<DC.DiscordUser>('GET', '/users/@me')
    return adaptUser(data)
  }

  private async sendEmbedMessage(requestUrl: string, fileBuffer: Buffer, payload_json: Record<string, any> = {}) {
    const fd = new FormData()
    const type = await FileType.fromBuffer(fileBuffer)
    fd.append('file', fileBuffer, 'file.' + type.ext)
    fd.append('payload_json', JSON.stringify(payload_json))
    return this.request('POST', requestUrl, fd, fd.getHeaders())
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
    delete addition.content
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
        if (type === 'image' || type === 'video' && data.url) {
          if (data.url.startsWith('file://')) {
            const r = await this.sendEmbedMessage(requestUrl, readFileSync(data.url.slice(7)), {
              ...addition,
            })
            sentMessageId = r.id
          } else if (data.url.startsWith('base64://')) {
            const a = Buffer.from(data.url.slice(9), 'base64')
            const r = await this.sendEmbedMessage(requestUrl, a, {
              ...addition,
            })
            sentMessageId = r.id
          } else {
            const a = await axios.get(data.url, {
              responseType: 'arraybuffer',
            })
            const r = await this.sendEmbedMessage(requestUrl, a.data, {
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
    result.author.nickname = msg.member?.nick
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

  async executeWebhook(id: string, token: string, data: ExecuteWebhookBody, wait = false): Promise<string> {
    const chain = segment.parse(data.content)
    if (chain.filter(v => v.type === 'image').length > 10) {
      throw new Error('Up to 10 embed objects')
    }

    return await this.sendFullMessage(`/webhooks/${id}/${token}?wait=${wait}`, data.content, data)
  }

  async $getGuildMember(guildId: string, userId: string) {
    return this.request<GuildMember>('GET', `/guilds/${guildId}/members/${userId}`)
  }

  async $getGuildRoles(guildId: string) {
    return this.request<Role[]>('GET', `/guilds/${guildId}/roles`)
  }

  async $getChannel(channelId: string) {
    return this.request<DiscordChannel>('GET', `/channels/${channelId}`)
  }

  async $listGuildMembers(guildId: string, limit?: number, after?: string) {
    return this.request<GuildMember[]>('GET', `/guilds/${guildId}/members?limit=${limit || 1000}&after=${after || '0'}`)
  }

  async $getRoleMembers(guildId: string, roleId: string) {
    let members: GuildMember[] = []
    let after = '0'
    while (true) {
      const data = await this.$listGuildMembers(guildId, 1000, after)
      members = members.concat(data)
      if (data.length) {
        after = data[data.length - 1].user.id
      } else {
        break
      }
    }
    return members.filter(v => v.roles.includes(roleId))
  }

  async $modifyGuildMember(guildId: string, userId: string, data: {
    nick?: string
    roles?: string[]
    mute?: boolean
    deaf?: boolean
    channel_id?: string
  }) {
    return this.request('PATCH', `/guilds/${guildId}/members/${userId}`, data)
  }

  async $addGuildMemberRole(guildId: string, userId: string, roleId: string) {
    return this.request('PUT', `/guilds/${guildId}/members/${userId}/roles/${roleId}`)
  }

  async $removeGuildMemberRole(guildId: string, userId: string, roleId: string) {
    return this.request('DELETE', `/guilds/${guildId}/members/${userId}/roles/${roleId}`)
  }

  async $createGuildRole(guildId: string, data: GuildRoleBody) {
    return this.request('POST', `/guilds/${guildId}/roles`, data)
  }

  async $modifyGuildRole(guildId: string, roleId: string, data: Partial<GuildRoleBody>) {
    return this.request('PATCH', `/guilds/${guildId}/roles/${roleId}`, data)
  }

  async $modifyGuild(guildId: string, data: GuildBody) {
    return this.request('PATCH', `/guilds/${guildId}`, data)
  }

  async $createWebhook(channelId: string, data: {
    name: string;
    avatar?: string
  }) {
    return this.request('POST', `/channels/${channelId}/webhooks`, data)
  }

  async $modifyWebhook(webhookId: string, data: {
    name?: string;
    avatar?: string
    channel_id?: string
  }) {
    return this.request('PATCH', `/webhooks/${webhookId}`, data)
  }

  async $getChannelWebhooks(channelId: string) {
    return this.request<Webhook[]>('GET', `/channels/${channelId}/webhooks`)
  }

  async $getGuildWebhooks(guildId: string) {
    return this.request<Webhook[]>('GET', `/guilds/${guildId}/webhooks`)
  }

  async $modifyChannel(channelId, data: Pick<Channel, 'name' | 'type' | 'position' | 'topic' | 'nsfw' | 'rate_limit_per_user' | 'bitrate' | 'user_limit' | 'permission_overwrites' | 'parent_id'>) {
    return this.request('PATCH', `/channels/${channelId}`, data)
  }
}
