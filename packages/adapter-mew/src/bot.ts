import { Bot, segment } from 'koishi'
import axios, { Method } from 'axios'
import * as Mew from './types'
import { adaptChannel, adaptGroup, adaptUser } from './utils'
import { flake } from './flake'

export type HandleExternalAsset = 'auto' | 'download' | 'direct'
export type HandleMixedContent = 'auto' | 'separate' | 'attach'

export class SenderError extends Error {
  constructor(url: string, data: any, selfId?: string) {
    super(`Error when trying to request ${url}, data: ${JSON.stringify(data)}`)
    Object.defineProperties(this, {
      name: { value: 'SenderError' },
      selfId: { value: selfId || '' },
      data: { value: data },
      url: { value: url },
    })
  }
}

export class MewBot extends Bot<'mew'> {
  // _d = 0
  version = 'mew'
  // _ping: NodeJS.Timeout
  // _sessionId: string = ''

  async request<T = any>(method: Method, path: string, data?: any, exHeaders?: any): Promise<T> {
    const { axiosConfig } = this.app.options
    const endpoint = 'https://api.mew.fun/api/v1'
    const url = `${endpoint}${path}`
    try {
      const response = await axios({
        ...axiosConfig,
        // ...mew.axiosConfig,
        method,
        url,
        headers: {
          Authorization: `Bearer ${this.token}`,
          ...exHeaders,
        },
        data,
      })
      return response.data
    } catch (e) {
      if (e.response?.data) console.log(url, e.response.data)
      throw new SenderError(url, data, this.selfId)
    }
  }

  async getSelf() {
    const data = await this.request<Mew.User>('GET', '/users/@me')
    return adaptUser(data)
  }

  private async _sendEmbed(requestUrl: string, fileBuffer: Buffer, payload_json: Record<string, any> = {}) {
    // const fd = new FormData()
    // const type = await FileType.fromBuffer(fileBuffer)
    // fd.append('file', fileBuffer, 'file.' + type.ext)
    // fd.append('payload_json', JSON.stringify(payload_json))
    // const r = await this.request('POST', requestUrl, fd, fd.getHeaders())
    // return r.id as string
  }

  private async _sendContent(requestUrl: string, content: string, addition: Record<string, any>) {
    const r = await this.request('POST', requestUrl, {
      ...addition,
      content,
      nonce: flake.gen(),
    })
    return r.id as string
  }

  private parseQuote(chain: segment.Chain) {
    if (chain[0].type !== 'quote') return
    return chain.shift()?.data.id || ''
  }

  // @ts-ignore
  async sendPrivateMessage(channelId: string, content: string) {
    return this.sendMessage(channelId, content)
  }

  private async _sendAsset(requestUrl: string, type: string, data: Record<string, string>, addition: Record<string, any>) {
    // const { axiosConfig, discord = {} } = this.app.options

    // if (discord.handleMixedContent === 'separate' && addition.content) {
    //   await this._sendContent(requestUrl, addition.content, addition)
    //   addition.content = ''
    // }

    // if (data.url.startsWith('file://')) {
    //   return this._sendEmbed(requestUrl, readFileSync(data.url.slice(8)), addition)
    // } else if (data.url.startsWith('base64://')) {
    //   const a = Buffer.from(data.url.slice(9), 'base64')
    //   return await this._sendEmbed(requestUrl, a, addition)
    // }

    // const sendDirect = async () => {
    //   if (addition.content) {
    //     await this._sendContent(requestUrl, addition.content, addition)
    //   }
    //   return this._sendContent(requestUrl, data.url, addition)
    // }

    // const sendDownload = async () => {
    //   const a = await axios.get(data.url, {
    //     ...axiosConfig,
    //     ...discord.axiosConfig,
    //     responseType: 'arraybuffer',
    //     headers: {
    //       accept: type + '/*',
    //     },
    //   })
    //   return this._sendEmbed(requestUrl, a.data, addition)
    // }

    // const mode = data.mode as HandleExternalAsset || discord.handleExternalAsset
    // if (mode === 'download' || discord.handleMixedContent === 'attach' && addition.content) {
    //   return sendDownload()
    // } else if (mode === 'direct') {
    //   return sendDirect()
    // }

    // // auto mode
    // await axios.head(data.url, {
    //   ...axiosConfig,
    //   ...discord.axiosConfig,
    //   headers: {
    //     accept: type + '/*',
    //   },
    // }).then(({ headers }) => {
    //   if (headers['content-type'].startsWith(type)) {
    //     return sendDirect()
    //   } else {
    //     return sendDownload()
    //   }
    // }, sendDownload)
  }

  private async _sendMessage(requestUrl: string, content?: string, addition: Record<string, any> = {}) {
    // @ts-ignore
    const chain = segment.parse(content)
    let messageId = '0'
    let textBuffer = ''
    delete addition.content

    const sendBuffer = async () => {
      const content = textBuffer.trim()
      if (!content) return
      messageId = await this._sendContent(requestUrl, content, addition)
      textBuffer = ''
    }

    for (const code of chain) {
      const { type, data } = code
      if (type === 'text') {
        textBuffer += data.content.trim()
      } else if (type === 'at' && data.id) {
        textBuffer += `<@${data.id}>`
      } else if (type === 'at' && data.type === 'all') {
        textBuffer += `@everyone`
      } else if (type === 'at' && data.type === 'here') {
        textBuffer += `@here`
      } else if (type === 'sharp' && data.id) {
        textBuffer += `<#${data.id}>`
      } else if (type === 'face' && data.name && data.id) {
        textBuffer += `<:${data.name}:${data.id}>`
      }
    //   } else if ((type === 'image' || type === 'video') && data.url) {
    //     messageId = await this._sendAsset(requestUrl, type, data, {
    //       ...addition,
    //       content: textBuffer.trim(),
    //     })
    //     textBuffer = ''
    //   } else if (type === 'share') {
    //     await sendBuffer()
    //     const r = await this.request('POST', requestUrl, {
    //       ...addition,
    //       embeds: [{ ...data }],
    //     })
    //     messageId = r.id
    //   }
    // }
    }

    await sendBuffer()
    return messageId
  }

  // @ts-ignore
  async sendMessage(channelId: string, content: string, groupId?: string) {
    const session = this.createSession({ channelId, content, groupId, subtype: groupId ? 'group' : 'private' })
    if (await this.app.serial(session, 'before-send', session)) return

    const chain = segment.parse(session.content || '')
    const quote = this.parseQuote(chain)
    const message_reference = quote ? {
      message_id: quote,
    } : undefined

    session.messageId = await this._sendMessage(`/topics/${channelId}/messages`, session.content, { message_reference })

    this.app.emit(session, 'send', session)
    return session.messageId
  }

  deleteMessage(channelId: string, messageId: string) {
    return this.request('DELETE', `/topics/${channelId}/messages/${messageId}`)
  }

  async editMessage(channelId: string, messageId: string, content: string) {
    const chain = segment.parse(content)
    const image = chain.find(v => v.type === 'image')
    if (image) {
      throw new Error("You can't include embed object(s) while editing message.")
    }
    return this.request('PATCH', `/topics/${channelId}/messages/${messageId}`, {
      content,
    })
  }

  $getMessage(channelId: string, messageId: string) {
    return this.request<Mew.Message>('GET', `/topics/${channelId}/messages/${messageId}`)
  }

  async getUser(userId: string) {
    const data = await this.request<Mew.User>('GET', `/users/${userId}`)
    return adaptUser(data)
  }

  async getGroupMemberList(guildId: string) {
    const data = await this.$listGuildMembers(guildId)
    return data.map(v => adaptUser(v.objects.users[v.user_id]))
  }

  async getChannel(channelId: string) {
    const data = await this.$getChannel(channelId)
    return adaptChannel(data)
  }

  $getGuildMember(guildId: string, userId: string) {
    return this.request<Mew.Member>('GET', `/nodes/${guildId}/members/${userId}`)
  }

  async getGroupMember(groupId: string, userId: string) {
    const member = await this.$getGuildMember(groupId, userId)
    return {
      ...adaptUser(member.objects.users[member.user_id]),
      nickname: member.nick,
    }
  }

  $getGuildRoles(guildId: string) {
    return this.request<Mew.Role[]>('GET', `/nodes/${guildId}/roles`)
  }

  $getChannel(channelId: string) {
    return this.request<Mew.Topic>('GET', `/topics/${channelId}`)
  }

  $listGuildMembers(guildId: string, limit?: number, after?: string) {
    return this.request<Mew.Member[]>('GET', `/nodes/${guildId}/members?limit=${limit || 1000}&after=${after || '0'}`)
  }

  async $getRoleMembers(guildId: string, roleId: string) {
    let members: Mew.Member[] = []
    let after = '0'
    while (true) {
      const data = await this.$listGuildMembers(guildId, 1000, after)
      members = members.concat(data)
      if (data.length) {
        const lastData = data[data.length - 1]
        after = lastData.user_id
      } else {
        break
      }
    }
    return members.filter(v => v.roles.includes(roleId))
  }

  // $modifyGuildMember(guildId: string, userId: string, data: Partial<Mew.ModifyGuildMember>) {
  //   return this.request('PATCH', `/nodes/${guildId}/members/${userId}`, data)
  // }

  $addGuildMemberRole(guildId: string, userId: string, roleId: string) {
    return this.request('PUT', `/nodes/${guildId}/members/${userId}/roles/${roleId}`)
  }

  $removeGuildMemberRole(guildId: string, userId: string, roleId: string) {
    return this.request('DELETE', `/nodes/${guildId}/members/${userId}/roles/${roleId}`)
  }

  // $createGuildRole(guildId: string, data: Mew.GuildRoleBody) {
  //   return this.request('POST', `/nodes/${guildId}/roles`, data)
  // }

  // $createWebhook(channelId: string, data: {
  //   name: string;
  //   avatar?: string
  // }) {
  //   return this.request('POST', `/channels/${channelId}/webhooks`, data)
  // }

  // $modifyWebhook(webhookId: string, data: {
  //   name?: string;
  //   avatar?: string
  //   channel_id?: string
  // }) {
  //   return this.request('PATCH', `/webhooks/${webhookId}`, data)
  // }

  // $getChannelWebhooks(channelId: string) {
  //   return this.request<DC.Webhook[]>('GET', `/channels/${channelId}/webhooks`)
  // }

  // $getGuildWebhooks(guildId: string) {
  //   return this.request<DC.Webhook[]>('GET', `/guilds/${guildId}/webhooks`)
  // }

  // $modifyChannel(channelId: string, data: DC.ModifyChannel) {
  //   return this.request('PATCH', `/channels/${channelId}`, data)
  // }

  $getGuild(guildId: string) {
    return this.request<Mew.Node>('GET', `/guilds/${guildId}`)
  }

  async getGroup(groupId: string) {
    const data = await this.$getGuild(groupId)
    return adaptGroup(data)
  }

  async $getUserGuilds() {
    return this.request<Mew.Node[]>('GET', '/users/@me/nodes')
  }

  async getGroupList() {
    const data = await this.$getUserGuilds()
    return data.map(v => adaptGroup(v))
  }

  $getGuildChannels(guildId: string) {
    return this.request<Mew.Topic[]>('GET', `/nodes/${guildId}/channels`)
  }

  async getChannelList(groupId: string) {
    const data = await this.$getGuildChannels(groupId)
    return data.map(v => adaptChannel(v))
  }
}
