import { Session as Meta, ResponsePayload } from 'koishi-core'
import { MockedApp } from './app'

export const createMessageMeta = (type: 'user' | 'group', message: string, userId: number, ctxId: number) => new Meta({
  [type + 'Id']: ctxId,
  postType: 'message',
  messageType: type === 'user' ? 'private' : type,
  message,
  userId,
  sender: {
    sex: 'unknown',
    age: 0,
    userId,
    nickname: '' + userId,
  },
})

export class Session {
  meta: Meta

  constructor (public app: MockedApp, public type: 'user' | 'group', public userId: number, public ctxId: number) {
    this.meta = createMessageMeta(type, null, userId, ctxId)
  }

  async send (message: string) {
    const replies: string[] = []
    function $response (data: ResponsePayload) {
      if (data.reply) replies.push(data.reply)
    }
    await this.app.receiveMessage(new Meta({ ...this.meta, message, $response }))
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

  shouldHaveNoReply (message: string) {
    return expect(this.send(message)).resolves.toHaveLength(0)
  }

  shouldMatchSnapshot (message: string) {
    return expect(this.send(message)).resolves.toMatchSnapshot(message)
  }
}
