import axios, { Method } from 'axios'
import { AuthorInfo, Bot, MessageInfo } from 'koishi-core'
import * as DC from './types'
import { adaptUser } from './utils'
import { segment } from 'koishi-utils'
import FormData from 'form-data'
const fs = require('fs')
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

  private async sendEmbedMessage(channelId: string, filePath: string) {
    const fd = new FormData()
    fd.append('file', fs.createReadStream(filePath))
    const headers: Record<string, any> = {
      Authorization: `Bot ${this.token}`,
    }
    const response = await axios({
      method: 'post',
      url: `https://discord.com/api/v8/channels/${channelId}/messages`,
      headers: { ...headers, ...fd.getHeaders() },
      data: fd,
    })
    return response.data
  }

  async sendMessage(channelId: string, content: string) {
    const session = this.createSession({ channelId, content })
    if (await this.app.serial(session, 'before-send', session)) return

    const chain = segment.parse(session.content)
    let sentMessageId = '0'
    for (const code of chain) {
      const { type, data } = code
      if (type === 'text') {
        const r = await this.request('POST', `/channels/${channelId}/messages`, {
          content: data.content,
        })
        sentMessageId = r.id
      } else if (type === 'image') {
        if (data.url.startsWith('http://') || data.url.startsWith('https://')) {
          const r = await this.request('POST', `/channels/${channelId}/messages`, {
            embed: {
              url: data.url,
            },
          })
          sentMessageId = r.id
        } else {
          const r = await this.sendEmbedMessage(channelId, data.url)
          sentMessageId = r.id
        }
      }
    }

    this.app.emit(session, 'send', session)
    return session.messageId = sentMessageId
  }
}
