/* eslint-disable quote-props */

import { AuthorInfo, Bot, MessageInfo } from 'koishi-core'
import { camelize, segment, pick, renameProperty, snakeCase } from 'koishi-utils'
import axios, { Method } from 'axios'
import * as KHL from './types'
import { adaptGroup, adaptAuthor, adaptUser } from './utils'

export interface KaiheilaMessageInfo extends MessageInfo {
  channelName?: string
  mention?: string[]
  mentionRoles?: string[]
  mentionAll?: boolean
  mentionHere?: boolean
  author?: AuthorInfo
}

export class KaiheilaBot extends Bot {
  _sn = 0
  _ping: NodeJS.Timeout
  _heartbeat: NodeJS.Timeout
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
      discriminator: author.identifyNum,
      avatar: author.avatar,
      username: author.username,
      nickname: author.nickname,
      roles: author.roles,
    }
    data.subtype = data['channelType'] === 'GROUP' ? 'group' : 'private'
    data.content = data.content
      .replace(/@(.+?)#(\d+)/, (_, $1, $2) => `[CQ:at,id=${$2}]`)
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
    const result = camelize(response.data)
    return result.data
  }

  async sendMessage(channelId: string, content: string) {
    let path: string
    const params = {} as KHL.MessageParams
    const session = this.createSession({ channelId, content })
    if (channelId.length > 30) {
      params.chatCode = channelId
      session.subtype = 'private'
      path = '/user-chat/create-msg'
    } else {
      params.targetId = channelId
      session.subtype = 'group'
      // FIXME this is incorrect but to workarournd ctx.group()
      session.groupId = 'unknown'
      path = '/message/create'
    }

    // trigger before-send
    if (await this.app.serial(session, 'before-send', session)) return

    let textBuffer = ''
    const flush = async () => {
      textBuffer = textBuffer.trim()
      if (!textBuffer) return
      params.type = KHL.Type.text
      params.content = textBuffer
      const message = await this.request('POST', path, params)
      session.messageId = message.msgId
      this.app.emit(session, 'send', session)
      params.quote = null
      textBuffer = ''
    }

    const chain = segment.parse(content)
    if (chain[0].type === 'quote') {
      params.quote = chain.shift().data.id
    }
    for (const { type, data } of chain) {
      if (type === 'text') {
        textBuffer += data.content
      } else if (type === 'at') {
        if (data.id) {
          textBuffer += `@user#${data.id}`
        } else if (data.type === 'all') {
          textBuffer += '@全体成员'
        } else if (data.type === 'here') {
          textBuffer += '@在线成员'
        } else if (data.role) {
          textBuffer += `@role:${data.role};`
        }
      } else if (type === 'sharp') {
        textBuffer += `#channel:${data.id};`
      } else if (type === 'card') {
        await flush()
        params.type = KHL.Type.card
        params.content = JSON.stringify([JSON.parse(data.content)])
        console.log(params)
        const message = await this.request('POST', path, params)
        session.messageId = message.msgId
        this.app.emit(session, 'send', session)
      }
    }

    await flush()
    return session.messageId
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
      await this.request('POST', '/message/update', { msgId, content })
    }
  }

  async getSelf() {
    const data = adaptUser(await this.request<KHL.Self>('GET', '/user/me'))
    renameProperty(data, 'selfId' as never, 'userId')
    return data
  }

  async getGroupList() {
    const { items } = await this.request<KHL.GuildList>('GET', '/guild/list')
    return items.map(adaptGroup)
  }

  async getGroupMemberList() {
    const { items } = await this.request<KHL.GuildMemberList>('GET', '/guild/user-list')
    return items.map(adaptAuthor)
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
