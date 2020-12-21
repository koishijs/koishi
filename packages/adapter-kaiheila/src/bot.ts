/* eslint-disable quote-props */

import { App, Bot, BotStatusCode, MessageInfo, Session } from 'koishi-core'
import { camelize, CQCode, renameProperty, snakeCase } from 'koishi-utils'
import axios, { Method } from 'axios'

export interface KaiheilaMessageInfo extends MessageInfo {

}

export class KaiheilaBot extends Bot {
  static toMessage(data: KaiheilaMessageInfo) {
    renameProperty(data, 'timestamp', 'msgTimestamp')
    renameProperty(data, 'messageId', 'msgId')
    data.content = data.content
      .replace(/@(.+?)#(\d+)/, (_, $1, $2) => `[CQ:at,qq=${$2}]`)
      .replace(/@全体成员/, () => `[CQ:at,type=all]`)
      .replace(/@在线成员/, () => `[CQ:at,type=here]`)
      .replace(/@role:(\d+);/, (_, $1) => `[CQ:at,role=${$1}]`)
      .replace(/#channel:(\d+);/, (_, $1) => `[CQ:sharp,id=${$1}]`)
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
