/* eslint-disable quote-props */

import { AuthorInfo, Bot, MessageInfo } from 'koishi-core'
import { camelize, CQCode, pick, renameProperty, snakeCase } from 'koishi-utils'
import axios, { Method } from 'axios'
import * as KHL from './types'
import { adaptGroup, adaptUser } from './utils'

declare module 'koishi-core/dist/adapter' {
  namespace Bot {
    interface Platforms {
      kaiheila: KaiheilaBot
    }
  }

  interface BotOptions {
    verifyToken?: string
  }
}

export interface KaiheilaAuthorInfo extends AuthorInfo {
  avatar?: string
  descriminator?: string
}

export interface KaiheilaMessageInfo extends MessageInfo {
  channelName?: string
  mention?: string[]
  mentionRoles?: string[]
  mentionAll?: boolean
  mentionHere?: boolean
  author?: KaiheilaAuthorInfo
}

export class KaiheilaBot extends Bot {
  _sn = 0
  _ping: NodeJS.Timeout
  version = 'kaiheila'

  static toMessage(data: KaiheilaMessageInfo & Record<string, any>) {
    renameProperty(data, 'channelId', 'targetId')
    renameProperty(data, 'timestamp', 'msgTimestamp')
    renameProperty(data, 'messageId', 'msgId')
    renameProperty(data, 'userId', 'authorId')
    const { author, channelName, guildId } = data.extra
    data.channelName = channelName
    data.groupId = guildId
    data.author = {
      userId: data.userId,
      descriminator: author.identifyNum,
      avatar: author.avatar,
      username: author.username,
      nickname: author.nickname,
      roles: author.roles,
    }
    data.subtype = data['channelType'] === 'GROUP' ? 'group' : 'private'
    data.content = data.content
      .replace(/@(.+?)#(\d+)/, (_, $1, $2) => `[CQ:at,qq=${$2}]`)
      .replace(/@全体成员/, () => `[CQ:at,type=all]`)
      .replace(/@在线成员/, () => `[CQ:at,type=here]`)
      .replace(/@role:(\d+);/, (_, $1) => `[CQ:at,role=${$1}]`)
      .replace(/#channel:(\d+);/, (_, $1) => `[CQ:sharp,id=${$1}]`)
    Object.assign(data, pick(data.extra, ['mention', 'mentionRoles', 'memtionAll', 'mentionHere']))
    delete data.channelType
    delete data.verifyToken
    delete data.nonce
    delete data.type
    delete data.extra
  }

  parseChannel(source: string) {
    if (/^\d+$/.test(source)) return source
    const code = CQCode.parse(source)
    if (code && code.type === 'sharp') {
      return code.data.id
    }
  }

  async request<T = any>(method: Method, path: string, data: any = {}): Promise<T> {
    const url = `${this.app.options.kaiheila.endpoint}${path}`
    const headers: Record<string, any> = {
      'Authorization': `Bot ${this.token}`,
      'Content-Type': 'application/json',
    }

    const response = await axios({
      method,
      url,
      headers,
      data: JSON.stringify(snakeCase(data)),
    })
    return camelize<T>(response.data)
  }

  private processGuildMessage(content: string) {
    return CQCode.parseAll(content).reduce<string>((prev, code) => {
      if (typeof code === 'string') return prev + code
      const { type, data } = code
      if (type === 'at') {
        if (data.qq) return prev + `@user#${data.qq}`
        if (data.type === 'all') return prev + '@全体成员'
        if (data.type === 'here') return prev + '@在线成员'
        if (data.role) return prev + `@role:${data.role};`
      } else if (type === 'sharp') {
        return prev + `#channel:${data.id};`
      }
      return prev
    }, '')
  }

  async sendMessage(channelId: string, content: string) {
    let key = 'channelId', path = '/message/create'
    if (channelId.length > 30) {
      key = 'chatCode'
      path = '/user-chat/create-msg'
    } else {
      content = this.processGuildMessage(content)
    }
    const message = await this.request('POST', path, { [key]: channelId, content })
    return message.msgId
  }

  async sendPrivateMessage(targetId: string, content: string) {
    const { code } = await this.request('POST', '/user-chat/create', { targetId })
    return this.sendMessage(code, content)
  }

  async deleteMessage(channelId: string, msgId: string) {
    if (channelId.length > 30) {
      await this.request('POST', '/user-chat/delete-msg', { msgId })
    } else {
      await this.request('POST', '/message/delete', { msgId })
    }
  }

  async editMessage(channelId: string, msgId: string, content: string) {
    if (channelId.length > 30) {
      await this.request('POST', '/user-chat/update-msg', { msgId, content })
    } else {
      content = this.processGuildMessage(content)
      await this.request('POST', '/message/update', { msgId, content })
    }
  }

  async getStatusCode() {
    if (!this.ready) return Bot.Status.BOT_IDLE
    return Bot.Status.GOOD
  }

  async getGroupList() {
    const { items } = await this.request<KHL.GuildList>('GET', '/guild/list')
    return items.map(adaptGroup)
  }

  async getGroupMemberList() {
    const { items } = await this.request<KHL.GuildMemberList>('GET', '/guild/user-list')
    return items.map(adaptUser)
  }

  async setGroupNickname(guildId: string, userId: string, nickname: string) {
    await this.request('POST', '/guild/nickname', { guildId, userId, nickname })
  }

  async leaveGroup(guildId: string) {
    await this.request('POST', '/guild/leave', { guildId })
  }

  async kickGroup(guildId: string, userId: string) {
    await this.request('POST', '/guild/kickout', { guildId, userId })
  }
}
