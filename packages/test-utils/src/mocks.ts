import { BASE_SELF_ID } from './utils'
import { snakeCase, sleep } from 'koishi-utils'
import { AppOptions, App, Sender, Server, ContextType, ResponsePayload, MessageMeta } from 'koishi-core'

class MockedServer extends Server {
  constructor (app: App) {
    super(app)
    this.appMap[app.selfId] = app
  }

  _close () {}
  async _listen () {}
}

export type RequestInfo = readonly [string, Record<string, any>]

class MockedSender extends Sender {
  requests: RequestInfo[] = []

  constructor (app: App) {
    super(app)
    this._get = async (action: string, params: Record<string, any> = {}) => {
      this.requests.unshift([action, params])
      return { status: 'succeed', retcode: 0, data: {} }
    }
  }

  getAsync (action: string, params?: Record<string, any>) {
    return this.get(action, params)
  }
}

export class MockedApp extends App {
  sender: MockedSender
  server: MockedServer

  constructor (options: AppOptions = {}) {
    super({ selfId: BASE_SELF_ID, ...options })
    this.sender = new MockedSender(this)
    this.server = new MockedServer(this)
  }

  receive (meta: MessageMeta): Promise<void> {
    this.server.dispatchMeta(meta)
    return sleep(0)
  }

  shouldHaveLastRequest (action: string, params: Record<string, any> = {}) {
    expect(this.sender.requests[0]).toMatchObject([action, snakeCase(params)])
  }

  shouldHaveLastRequests (requests: RequestInfo[]) {
    expect(this.sender.requests.slice(0, requests.length)).toMatchObject(requests.map(snakeCase).reverse())
  }

  createSession (type: 'user', userId: number): Session
  createSession (type: 'group', userId: number, groupId: number): Session
  createSession (type: 'discuss', userId: number, discussId: number): Session
  createSession (type: ContextType, userId: number, ctxId: number = userId) {
    return new Session(this, {
      userId,
      selfId: this.selfId,
      postType: 'message',
      messageType: type === 'user' ? 'private' : type,
      [`${type}Id`]: ctxId,
    })
  }
}

export class Session {
  constructor (public app: MockedApp, public meta: MessageMeta) {}

  async send (message: string) {
    let payload: ResponsePayload = null
    function $response (data: ResponsePayload) {
      payload = data
    }
    await this.app.receive({ ...this.meta, message, $response })
    return payload
  }

  async getReply (message: string) {
    const response = await this.send(message)
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
    return expect(this.send(message)).resolves.toBeNull()
  }

  shouldMatchSnapshot (message: string) {
    return expect(this.getReply(message)).resolves.toMatchSnapshot(message)
  }
}
