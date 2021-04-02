/* eslint-disable quote-props */

import { AuthorInfo, Bot, MessageInfo } from 'koishi-core'
import { camelize, segment, pick, renameProperty, snakeCase } from 'koishi-utils'
import axios, { Method } from 'axios'
import * as Kaiheila from './types'
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

  private parseQuote(chain: segment.Chain) {
    if (chain[0].type !== 'quote') return
    return chain.shift().data.id
  }

  private parseNode(node: segment.Parsed) {
    if (node.type === 'image') {
      return { type: 'image', src: node.data.url, size: node.data.size }
    } else if (node.type === 'button') {
      return { type: 'button', text: node.data.content }
    }
  }

  private parseCard(chain: segment.Chain) {
    if (chain[0].type !== 'card') return
    const node = chain.shift()
    const card = { type: 'card', modules: [], ...pick(node.data, ['theme', 'color', 'size']) }
    for (const node of chain) {
      if (node.type === 'text') {
        card.modules.push({ type: 'plain-text', content: node.data.content })
      } else if (node.type === 'header') {
        card.modules.push({ type: 'header', text: { type: 'plain-text', content: node.data.content } })
      } else if (node.type === 'section') {
        card.modules.push({
          type: 'section',
          mode: node.data.mode,
          text: { type: 'kmarkdown', content: node.data.content },
          accessory: this.parseNode(segment.from(node.data.accessory)),
        })
      } else if (node.type === 'divider') {
        card.modules.push({ type: 'divider' })
      }
    }
    return JSON.stringify([card])
  }

  private renderText(chain: segment.Chain) {
    return chain.reduce<string>((prev, code) => {
      const { type, data } = code
      if (type === 'text') {
        return prev + data.content
      } else if (type === 'at') {
        if (data.id) return prev + `@user#${data.id}`
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
    let path: string
    const params: any = { type: 1 }
    const session = this.createSession({ channelId, content })
    if (channelId.length > 30) {
      params.chatCode = channelId
      session.subtype = 'private'
      path = '/user-chat/create-msg'
    } else {
      params.channelId = channelId
      session.subtype = 'group'
      // FIXME this is incorrect but to workarournd ctx.group()
      session.groupId = 'unknown'
      path = '/message/create'
    }

    // trigger before-send
    if (await this.app.serial(session, 'before-send', session)) return

    // parse quote
    const chain = segment.parse(session.content)
    params.quote = this.parseQuote(chain)

    // parse card
    const card = this.parseCard(chain)
    if (card) {
      params.type = Kaiheila.Type.card
      params.content = card
    } else {
      params.content = this.renderText(chain)
    }

    const message = await this.request('POST', path, params)
    this.app.emit(session, 'send', session)
    return session.messageId = message.msgId
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
    const chain = segment.parse(content)
    const quote = this.parseQuote(chain)
    content = this.renderText(chain)
    if (channelId.length > 30) {
      await this.request('POST', '/user-chat/update-msg', { msgId, content, quote })
    } else {
      await this.request('POST', '/message/update', { msgId, content, quote })
    }
  }

  async getSelf() {
    const data = adaptUser(await this.request<Kaiheila.Self>('GET', '/user/me'))
    renameProperty(data, 'selfId' as never, 'userId')
    return data
  }

  async getGroupList() {
    const { items } = await this.request<Kaiheila.GuildList>('GET', '/guild/list')
    return items.map(adaptGroup)
  }

  async getGroupMemberList() {
    const { items } = await this.request<Kaiheila.GuildMemberList>('GET', '/guild/user-list')
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
