import { App, Meta, ContextType, Server, ResponsePayload, Sender } from 'koishi-core'

class SessionServer extends Server {
  _close () {}
  async _listen () {}
}

export class Session {
  meta: Meta
  server: Server

  constructor (app: App, type: 'user', userId: number)
  constructor (app: App, type: 'group', userId: number, groupId: number)
  constructor (app: App, type: 'discuss', userId: number, discussId: number)
  constructor (public app: App, type: ContextType, userId: number, ctxId: number = userId) {
    app.sender = new Sender(app)
    this.server = new SessionServer(app)
    this.meta = {
      userId,
      selfId: app.selfId,
      postType: 'message',
      messageType: type === 'user' ? 'private' : type,
      [`${type}Id`]: ctxId,
    }
  }

  receive (message: string): Promise<ResponsePayload> {
    return new Promise((resolve) => {
      let payload: ResponsePayload = null
      this.app.receiver.once('after-middlewares', () => resolve(payload))
      this.server.dispatchMeta({ ...this.meta, message, $response: data => payload = data })
    })
  }

  async getReply (message: string) {
    const response = await this.receive(message)
    return response && response.reply
  }

  shouldHaveNoResponse (message: string) {
    return expect(this.receive(message)).resolves.toBeNull()
  }

  shouldMatchSnapshot (message: string) {
    return this.expectReply(message).toMatchSnapshot(message)
  }

  expectReply (message: string) {
    return expect(this.getReply(message)).resolves
  }
}
