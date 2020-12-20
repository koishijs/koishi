/* eslint-disable quote-props */

import { App, Bot, BotStatusCode, MessageInfo, Session } from 'koishi-core'
import { camelize, renameProperty, snakeCase } from 'koishi-utils'
import axios, { Method } from 'axios'

export interface KaiheilaMessageInfo extends MessageInfo {

}

export class KaiheilaBot extends Bot {
  static toMessage(data: KaiheilaMessageInfo) {
    renameProperty(data, 'timestamp', 'msgTimestamp')
    renameProperty(data, 'messageId', 'msgId')
    data.content = data.content
      .replace(/@(.+?)#(\d+)/, (_, $1, $2) => `[CQ:at,qq=${$2}]`)
      .replace(/@全体成员/, () => `[CQ:at,qq=all]`)
      .replace(/@在线成员/, () => `[CQ:at,qq=here]`)
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

  async getStatusCode() {
    if (!this.ready) return BotStatusCode.BOT_IDLE
    return BotStatusCode.GOOD
  }
}

export function createSession(app: App, data: any) {
  const session = new Session(app, data)
  return session
}
