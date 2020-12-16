/* eslint-disable quote-props */

import { App, Bot, MessageInfo, Session } from 'koishi-core'
import { camelize, renameProperty, snakeCase } from 'koishi-utils'
import axios, { Method } from 'axios'

export interface KaiheilaMessageInfo extends MessageInfo {

}

export class KaiheilaBot extends Bot {
  static toMessage(data: KaiheilaMessageInfo) {
    renameProperty(data, 'timestamp', 'msgTimestamp')
    renameProperty(data, 'messageId', 'msgId')
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
    const message = await this.request('POST', '/channel/message', { channelId, content })
    return message.msgId
  }
}

export function createSession(app: App, data: any) {
  const session = new Session(app, data)
  return session
}
