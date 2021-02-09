/* eslint-disable quote-props */

import { App, AuthorInfo, Bot, BotStatusCode, MessageInfo, Session } from 'koishi-core'
import { camelize, CQCode, pick, renameProperty, snakeCase } from 'koishi-utils'
import axios, { Method } from 'axios'

declare module 'koishi-core/dist/server' {
  namespace Bot {
    interface Platforms {
      kaiheila: KaiheilaBot
    }
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

  async request(method: Method, path: string, data: any = {}): Promise<any> {
    const url = `https://www.kaiheila.cn/api/v3${path}`
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
    return camelize(response.data)
  }

  async sendMessage(channelId: string, content: string) {
    content = CQCode.parseAll(content).reduce<string>((prev, code) => {
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
    const message = await this.request('POST', '/channel/message', { channelId, content })
    return message.msgId
  }

  async getStatusCode() {
    if (!this.ready) return BotStatusCode.BOT_IDLE
    return BotStatusCode.GOOD
  }
}

export function createSession(app: App, data: any) {
  const session = new Session(app, data)
  return session
}
