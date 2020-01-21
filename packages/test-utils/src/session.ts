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
    let payload: ResponsePayload = null
    function $response (data: ResponsePayload) {
      payload = data
    }
    await this.app.receiveMessage({ ...this.meta, message, $response })
    return payload
  }

  async getReply (message: string) {
    const response = await this.send(message)
    return response?.reply
  }

  shouldHaveReply (message: string, reply?: string) {
    if (reply) {
      return expect(this.getReply(message)).resolves.toBe(reply)
    } else {
      return expect(this.getReply(message)).resolves.toBeTruthy()
    }
  }

  shouldHaveNoResponse (message: string) {
    return expect(this.send(message)).resolves.toBeNull()
  }

  shouldMatchSnapshot (message: string) {
    return expect(this.getReply(message)).resolves.toMatchSnapshot(message)
  }
}
