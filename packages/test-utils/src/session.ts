import { App, Meta, ContextType, Server, ResponsePayload, Sender } from 'koishi-core'

const refs = new WeakSet<App>()

class SessionServer extends Server {
  _close () {}
  async _listen () {}
}

export class Session {
  meta: Meta

  constructor (app: App, type: 'user', userId: number)
  constructor (app: App, type: 'group', userId: number, groupId: number)
  constructor (app: App, type: 'discuss', userId: number, discussId: number)
  constructor (public app: App, type: ContextType, userId: number, ctxId: number = userId) {
    if (!refs.has(app)) {
      refs.add(app)
      app.sender = new Sender(app)
      app.server = new SessionServer(app)
    }

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
      function $response (data: ResponsePayload) {
        payload = data
      }

      this.app.receiver.once('after-middlewares', () => resolve(payload))
      this.app.server.dispatchMeta({ ...this.meta, message, $response })
    })
  }

  async getReply (message: string) {
    const response = await this.receive(message)
    return response && response.reply
  }

  shouldHaveReply (message: string, reply?: string) {
    if (reply) {
      return expect(this.getReply(message)).resolves.toBe(reply)
    } else {
      return expect(this.getReply(message)).resolves.toBeTruthy()
    }
  }

  shouldHaveNoResponse (message: string) {
    return expect(this.receive(message)).resolves.toBeNull()
  }

  shouldMatchSnapshot (message: string) {
    return expect(this.getReply(message)).resolves.toMatchSnapshot(message)
  }
}
