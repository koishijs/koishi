import { Meta, ContextType, ResponsePayload } from 'koishi-core'
import { MockedApp } from './app'

export const createMessageMeta = (type: ContextType, message: string, userId: number, ctxId: number): Meta<'message'> => ({
  [type + 'Id']: ctxId,
  postType: 'message',
  messageType: type === 'user' ? 'private' : type,
  message,
  userId,
})

export class Session {
  meta: Meta<'message'>

  constructor (public app: MockedApp, public type: ContextType, public userId: number, public ctxId: number) {
    this.meta = createMessageMeta(type, null, userId, ctxId)
  }

  async send (message: string) {
    let replies: string[] = []
    function $response (data: ResponsePayload) {
      if (data.reply) replies.push(data.reply)
    }
    await this.app.receiveMessage({ ...this.meta, message, $response })
    return replies
  }

  async shouldHaveReply (message: string, reply?: string) {
    const replies = await this.send(message)
    const lastReply = replies[replies.length - 1]
    if (reply) {
      return expect(lastReply).toBe(reply)
    } else {
      return expect(lastReply).toBeTruthy()
    }
  }

  shouldHaveNoReplies (message: string) {
    return expect(this.send(message)).resolves.toHaveLength(0)
  }

  shouldMatchSnapshot (message: string) {
    return expect(this.send(message)).resolves.toMatchSnapshot(message)
  }
}
