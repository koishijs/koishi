/* eslint-disable quote-props */

import { AuthorInfo, Bot, MessageInfo, Session } from 'koishi-core'
import { camelize, segment, pick, renameProperty, snakeCase } from 'koishi-utils'
import axios, { Method } from 'axios'
import * as KHL from './types'
import { adaptGroup, adaptAuthor, adaptUser } from './utils'
import FormData from 'form-data'
import { createReadStream } from 'fs'

export interface KaiheilaMessageInfo extends MessageInfo {
  channelName?: string
  mention?: string[]
  mentionRoles?: string[]
  mentionAll?: boolean
  mentionHere?: boolean
  author?: AuthorInfo
}

const attachmentTypes = ['image', 'video', 'audio', 'file']

type SendHandle = [string, KHL.MessageParams, Session<never, never, 'kaiheila', 'send'>]

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

  async request<T = any>(method: Method, path: string, data: any = {}, headers: any = {}): Promise<T> {
    const url = `${this.app.options.kaiheila.endpoint}${path}`
    headers = {
      'Authorization': `Bot ${this.token}`,
      'Content-Type': 'application/json',
      ...headers,
    }

    const response = await axios({
      method,
      url,
      headers,
      data: data instanceof FormData ? data : JSON.stringify(snakeCase(data)),
    })
    const result = camelize(response.data)
    return result.data
  }

  private _prepareHandle(channelId: string, content: string): SendHandle {
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
    return [path, params, session]
  }

  private async _sendHandle([path, params, session]: SendHandle, type: KHL.Type, content: string) {
    params.type = type
    params.content = content
    const message = await this.request('POST', path, params)
    session.messageId = message.msgId
    this.app.emit(session, 'send', session)
  }

  private async _transformUrl({ type, data }: segment.Parsed) {
    if (data.url.startsWith('file://') || data.url.startsWith('base64://')) {
      const payload = new FormData()
      payload.append('file', data.url.startsWith('file://')
        ? createReadStream(data.url.slice(7))
        : Buffer.from(data.url.slice(9), 'base64'))
      const { url } = await this.request('POST', '/asset/create', payload, payload.getHeaders())
      data.url = url
    } else if (!data.url.includes('kaiheila')) {
      const res = await axios.get<ReadableStream>(data.url, {
        responseType: 'stream',
        headers: { accept: type },
      })
      const payload = new FormData()
      payload.append('file', res.data)
      const { url } = await this.request('POST', '/asset/create', payload, payload.getHeaders())
      data.url = url
      console.log(url)
    }
  }

  private async _sendCard(handle: SendHandle, chain: segment.Chain) {
    let text: KHL.Card.Text = { type: 'plain-text', content: '' }
    let card: KHL.Card = { type: 'card', modules: [] }
    const output: KHL.Card[] = []
    const flushText = () => {
      text.content = text.content.trim()
      if (!text.content) return
      card.modules.push({ type: 'section', text })
      text = { type: 'plain-text', content: '' }
    }
    const flushCard = () => {
      flushText()
      if (!card.modules.length) return
      output.push(card)
      card = { type: 'card', modules: [] }
    }

    for (const { type, data } of chain) {
      if (type === 'text') {
        text.content += data.content
      } else if (type === 'at') {
        if (data.id) {
          text.content += `@user#${data.id}`
        } else if (data.type === 'all') {
          text.content += '@全体成员'
        } else if (data.type === 'here') {
          text.content += '@在线成员'
        } else if (data.role) {
          text.content += `@role:${data.role};`
        }
      } else if (type === 'sharp') {
        text.content += `#channel:${data.id};`
      } else if (attachmentTypes.includes(type)) {
        flushText()
        await this._transformUrl({ type, data })
        if (type === 'image') {
          card.modules.push({
            type: 'image-group',
            elements: [{
              type: 'image',
              src: data.url,
            }],
          })
        } else {
          card.modules.push({
            type: type as never,
            src: data.url,
          })
        }
      } else if (type === 'card') {
        flushCard()
        output.push(JSON.parse(data.content))
      }
    }
    flushCard()
    await this._sendHandle(handle, KHL.Type.card, JSON.stringify(output))
  }

  private async _sendSeparate(handle: SendHandle, chain: segment.Chain) {
    let textBuffer = ''
    const flush = async () => {
      textBuffer = textBuffer.trim()
      if (!textBuffer) return
      await this._sendHandle(handle, KHL.Type.text, textBuffer)
      handle[1].quote = null
      textBuffer = ''
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
      } else if (attachmentTypes.includes(type)) {
        await flush()
        await this._transformUrl({ type, data })
        await this._sendHandle(handle, KHL.Type[type], data.url)
      } else if (type === 'card') {
        await flush()
        await this._sendHandle(handle, KHL.Type.card, JSON.stringify([JSON.parse(data.content)]))
      }
    }
    await flush()
  }

  async sendMessage(channelId: string, content: string) {
    const handle = this._prepareHandle(channelId, content)
    const [, params, session] = handle
    if (await this.app.serial(session, 'before-send', session)) return

    const chain = segment.parse(content)
    if (chain[0].type === 'quote') {
      params.quote = chain.shift().data.id
    }

    const { attachMode } = this.app.options.kaiheila
    const hasAttachment = chain.some(node => attachmentTypes.includes(node.type))
    const useCard = hasAttachment && (attachMode === 'card' || attachMode === 'mixed' && chain.length > 1)

    if (useCard) {
      await this._sendCard(handle, chain)
    } else {
      await this._sendSeparate(handle, chain)
    }

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
