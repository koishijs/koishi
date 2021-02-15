/* eslint-disable quote-props */

import { AuthorInfo, Bot, MessageInfo, Session } from 'koishi-core'
import { camelCase, camelize, CQCode, pick, renameProperty, snakeCase } from 'koishi-utils'
import axios, { Method } from 'axios'
import * as Kaiheila from './types'

declare module 'koishi-core/dist/server' {
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

  async sendMessage(channelId: string, content: string) {
    let key = 'channelId', path = '/channel/message'
    if (channelId.length > 30) {
      key = 'chatCode'
      path = '/user-chat/create-msg'
    } else {
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
    }
    const message = await this.request('POST', path, { [key]: channelId, content })
    return message.msgId
  }

  async getStatusCode() {
    if (!this.ready) return Bot.Status.BOT_IDLE
    return Bot.Status.GOOD
  }
}

function createMessage(data: Kaiheila.Data, meta: Kaiheila.MessageMeta, session: Partial<Session> = {}) {
  session.author = {
    userId: data.authorId,
    avatar: meta.author.avatar,
    username: meta.author.username,
    nickname: meta.author.nickname,
  }
  session.userId = data.authorId
  session.groupId = meta.guildId
  session.channelName = meta.channelName
  session.messageId = data.msgId
  session.timestamp = data.msgTimestamp
  if (data.channelType === 'GROUP') {
    session.subtype = 'group'
    session.channelId = data.targetId
  } else {
    session.subtype = 'private'
    session.channelId = meta.code
  }
  session.subtype = data.channelType === 'GROUP' ? 'group' : 'private'
  session.content = data.content
    .replace(/@(.+?)#(\d+)/, (_, $1, $2) => `[CQ:at,qq=${$2}]`)
    .replace(/@全体成员/, () => `[CQ:at,type=all]`)
    .replace(/@在线成员/, () => `[CQ:at,type=here]`)
    .replace(/@role:(\d+);/, (_, $1) => `[CQ:at,role=${$1}]`)
    .replace(/#channel:(\d+);/, (_, $1) => `[CQ:sharp,id=${$1}]`)
  return session
}

export function createSession(bot: KaiheilaBot, input: any) {
  const data = camelCase<Kaiheila.Data>(input)
  const session: Partial<Session> = {
    selfId: bot.selfId,
    platform: 'kaiheila',
  }
  if (data.type === Kaiheila.Type.system) {
    const { type, body } = data.extra as Kaiheila.Notice
    switch (type) {
      case 'updated_message':
      case 'updated_private_message':
        session.type = 'message-updated'
        createMessage(data, body, session)
        break
      case 'deleted_message':
      case 'deleted_private_message':
        session.type = 'message-deleted'
        createMessage(data, body, session)
        break
      default: return
    }
  } else {
    session.type = 'message'
    createMessage(data, data.extra as Kaiheila.MessageExtra, session)
  }
  return new Session(bot.app, session)
}
