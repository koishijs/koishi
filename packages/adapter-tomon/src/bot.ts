import { Bot, Session } from 'koishi-core'
import Tomon from 'tomon-sdk'

declare module 'koishi-core/dist/database' {
  interface Platforms {
    tomon: string
  }
}

export class TomonBot extends Bot {
  tomon?: Tomon

  async [Bot.$send](session: Session, message: string) {
    if (!message) return
    await this.send(session.channelId, message)
  }

  async send(channelId: string, content: string) {
    if (!content) return
    return this.tomon.api.route(`/channels/${channelId}/messages`).post({ data: { content } })
  }
}
