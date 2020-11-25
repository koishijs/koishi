import { Bot } from 'koishi-core'
import Tomon from 'tomon-sdk'

declare module 'koishi-core/dist/database' {
  interface Platforms {
    tomon: string
  }
}

export class TomonBot extends Bot {
  tomon?: Tomon

  async sendMessage(channelId: string, content: string) {
    return this.tomon.api.route(`/channels/${channelId}/messages`).post({ data: { content } })
  }
}
