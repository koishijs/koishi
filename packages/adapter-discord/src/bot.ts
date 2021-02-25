import axios, { Method } from 'axios'
import { AuthorInfo, Bot, MessageInfo } from 'koishi-core'
import * as DC from './types'
import { adaptUser } from './utils'

declare module 'koishi-core' {
  namespace Bot {
    interface Platforms {
      discord: DiscordBot
    }
  }
}

export class DiscordBot extends Bot {
  _d = 0
  version = 'discord'
  _ping: NodeJS.Timeout

  async request<T = any>(method: Method, path: string, data?: any): Promise<T> {
    const url = `https://discord.com/api/v8${path}`
    const headers: Record<string, any> = {
      Authorization: `Bot ${this.token}`,
    }
    const response = await axios({
      method,
      url,
      headers,
      data,
    })
    return response.data
  }

  async getSelf() {
    const data = await this.request<DC.Self>('GET', '/users/@me')
    return adaptUser(data)
  }

  async sendMessage(channelId: string, content: string) {
    const session = this.createSession({ channelId, content })
    if (await this.app.serial(session, 'before-send', session)) return
    const message = await this.request('POST', `/channels/${channelId}/messages`, {
      content,
    })
    this.app.emit(session, 'send', session)
    return session.messageId = message.id
  }
}
