import { BASE_SELF_ID, RequestData } from './utils'
import { snakeCase } from 'koishi-utils'
import { AppOptions, App, Sender, Server, ContextType, ResponsePayload, Meta, MessageMeta } from 'koishi-core'
import debug from 'debug'

class MockedServer extends Server {
  constructor (app: App) {
    super(app)
    this.appMap[app.selfId] = app
  }

  _close () {}

  async _listen () {
    this.version = {} as any
  }
}

class MockedSender extends Sender {
  requests: RequestData[] = []

  constructor (app: App) {
    super(app)
    this._get = async (action: string, params: Record<string, any>) => {
      this.requests.unshift([action, params])
      return { status: 'succeed', retcode: 0, data: {} }
    }
  }

  getAsync (action: string, params?: Record<string, any>) {
    return this.get(action, params)
  }
}

const createMessageMeta = (type: ContextType, message: string, userId: number, ctxId: number): MessageMeta => ({
  [type + 'Id']: ctxId,
  postType: 'message',
  messageType: type === 'user' ? 'private' : type,
  message,
  userId,
})

export class MockedApp extends App {
  sender: MockedSender
  server: MockedServer

  constructor (options: AppOptions = {}) {
    super({ selfId: BASE_SELF_ID, ...options })
    this.sender = new MockedSender(this)
    this.server = new MockedServer(this)
    this.receiver.on('logger', (scope, message) => {
      debug('koishi:' + scope)(message)
    })
  }

  receive (meta: Meta) {
    this.server.dispatchMeta({
      selfId: this.selfId,
      ...meta,
    })
  }

  receiveFriendRequest (userId: number, flag = 'flag') {
    this.receive({
      postType: 'request',
      requestType: 'friend',
      userId,
      flag,
    })
  }

  receiveGroupRequest (userId: number, subType: 'add' | 'invite', groupId = 10000, flag = 'flag') {
    this.receive({
      postType: 'request',
      requestType: 'group',
      subType,
      userId,
      groupId,
      flag,
    })
  }

  receiveMessage (meta: Meta): Promise<void>
  receiveMessage (type: 'user', message: string, userId: number): Promise<void>
  receiveMessage (type: 'group', message: string, userId: number, groupId: number): Promise<void>
  receiveMessage (type: 'discuss', message: string, userId: number, discussId: number): Promise<void>
  receiveMessage (type: ContextType | Meta, message?: string, userId?: number, ctxId: number = userId) {
    return new Promise((resolve) => {
      this.receiver.once('after-middleware', () => resolve())
      this.receive(typeof type === 'string' ? createMessageMeta(type, message, userId, ctxId) : type)
    })
  }

  clearRequests () {
    this.sender.requests = []
  }

  shouldHaveNoRequests () {
    expect(this.sender.requests).toHaveLength(0)
  }

  shouldHaveLastRequest (action: string, params: Record<string, any> = {}) {
    expect(this.sender.requests[0]).toMatchObject([action, snakeCase(params)])
    this.clearRequests()
  }

  shouldHaveLastRequests (requests: RequestData[]) {
    expect(this.sender.requests.slice(0, requests.length)).toMatchObject(requests.map(snakeCase).reverse())
    this.clearRequests()
  }

  createSession (type: 'user', userId: number): Session
  createSession (type: 'group', userId: number, groupId: number): Session
  createSession (type: 'discuss', userId: number, discussId: number): Session
  createSession (type: ContextType, userId: number, ctxId: number = userId) {
    return new Session(this, type, userId, ctxId)
  }
}

export class Session {
  meta: MessageMeta

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
