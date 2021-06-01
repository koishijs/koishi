/* eslint-disable quote-props */

import { AuthorInfo, Bot, Session } from 'koishi-core'
import { camelize, segment, renameProperty, snakeCase } from 'koishi-utils'
import axios, { Method } from 'axios'
import * as KHL from './types'
import { adaptGroup, adaptAuthor, adaptUser } from './utils'
import FormData from 'form-data'
import { createReadStream } from 'fs'

export interface KaiheilaMessageInfo {
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

  private _prepareHandle(channelId: string, content: string, groupId: string): SendHandle {
    let path: string
    const params = {} as KHL.MessageParams
    const session = this.createSession({ channelId, content, groupId })
    if (channelId.length > 30) {
      params.chatCode = channelId
      session.subtype = 'private'
      path = '/user-chat/create-msg'
    } else {
      params.targetId = channelId
      session.subtype = 'group'
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
        ? createReadStream(data.url.slice(8))
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

  private async _sendCard(handle: SendHandle, chain: segment.Chain, useMarkdown: boolean) {
    const type = useMarkdown ? 'kmarkdown' : 'plain-text'
    let text: KHL.Card.Text = { type, content: '' }
    let card: KHL.Card = { type: 'card', modules: [] }
    const output: KHL.Card[] = []
    const flushText = () => {
      text.content = text.content.trim()
      if (!text.content) return
      card.modules.push({ type: 'section', text })
      text = { type, content: '' }
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

  private async _sendSeparate(handle: SendHandle, chain: segment.Chain, useMarkdown: boolean) {
    let textBuffer = ''
    const type = useMarkdown ? KHL.Type.kmarkdown : KHL.Type.text
    const flush = async () => {
      textBuffer = textBuffer.trim()
      if (!textBuffer) return
      await this._sendHandle(handle, type, textBuffer)
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

  async sendMessage(channelId: string, content: string, groupId?: string) {
    const handle = this._prepareHandle(channelId, content, groupId)
    const [, params, session] = handle
    if (await this.app.serial(session, 'before-send', session)) return

    let useMarkdown = false
    const chain = segment.parse(content)
    if (chain[0].type === 'quote') {
      params.quote = chain.shift().data.id
    }
    if (chain[0].type === 'markdown') {
      useMarkdown = true
      chain.shift()
    }

    const { attachMode } = this.app.options.kaiheila
    const hasAttachment = chain.some(node => attachmentTypes.includes(node.type))
    const useCard = hasAttachment && (attachMode === 'card' || attachMode === 'mixed' && chain.length > 1)

    if (useCard) {
      await this._sendCard(handle, chain, useMarkdown)
    } else {
      await this._sendSeparate(handle, chain, useMarkdown)
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
