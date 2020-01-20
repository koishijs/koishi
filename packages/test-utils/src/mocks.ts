import { BASE_SELF_ID } from './utils'
import { snakeCase } from 'koishi-utils'
import { AppOptions, App, Sender, Server, ContextType, ResponsePayload, Meta, MessageMeta, CQResponse } from 'koishi-core'
import debug from 'debug'

type RequestParams = Record<string, any>
type RequestData = readonly [string, RequestParams]
type RequestHandler = (params: RequestParams) => Partial<CQResponse>

export class MockedServer {
  requests: RequestData[] = []
  responses: Record<string, RequestHandler> = {}

  clearRequests () {
    this.requests = []
  }

  shouldHaveNoRequests () {
    expect(this.requests).toHaveLength(0)
  }

  shouldHaveLastRequest (action: string, params: RequestParams = {}) {
    expect(this.requests[0]).toMatchObject([action, snakeCase(params)])
    this.clearRequests()
  }

  shouldHaveLastRequestMatchSnapshot (name?: string) {
    expect(this.requests[0]).toMatchSnapshot(name)
    this.clearRequests()
  }

  shouldHaveLastRequests (requests: RequestData[]) {
    expect(this.requests.slice(0, requests.length)).toMatchObject(requests.map(snakeCase).reverse())
    this.clearRequests()
  }

  receive (action: string, params: RequestParams = {}): CQResponse {
    this.requests.unshift([action, snakeCase(params)])
    const response = this.responses[action]?.(params)
    return {
      status: 'succeed',
      retcode: 0,
      data: {},
      ...response,
    }
  }

  setResponse (event: string, hanlder: RequestHandler): void
  setResponse (event: string, data: RequestParams, retcode?: number): void
  setResponse (event: string, ...args: [RequestHandler] | [RequestParams, number?]) {
    if (typeof args[0] === 'function') {
      this.responses[event] = args[0] as RequestHandler
    } else {
      this.responses[event] = () => ({
        data: snakeCase(args[0]),
        retcode: args[1] || 0,
        status: args[1] ? 'failed' : 'succeed',
      })
    }
  }
}

class MockedAppServer extends Server {
  constructor (app: App) {
    super(app)
    this.appMap[app.selfId] = app
  }

  _close () {}

  async _listen () {
    this.version = {} as any
  }
}

class MockedAppSender extends Sender {
  mock = new MockedServer()

  constructor (app: App) {
    super(app)
    this._get = async (action, params) => {
      return this.mock.receive(action.replace(/_async$/, ''), params)
    }
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
  sender: MockedAppSender
  server: MockedAppServer

  constructor (options: AppOptions = {}) {
    super({ selfId: BASE_SELF_ID, ...options })
    this.sender = new MockedAppSender(this)
    this.server = new MockedAppServer(this)
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
    this.sender.mock.clearRequests()
  }

  shouldHaveNoRequests () {
    this.sender.mock.shouldHaveNoRequests()
  }

  shouldHaveLastRequest (action: string, params: RequestParams = {}) {
    this.sender.mock.shouldHaveLastRequest(action, params)
  }

  shouldHaveLastRequests (requests: RequestData[]) {
    this.sender.mock.shouldHaveLastRequests(requests)
  }

  shouldHaveLastRequestMatchSnapshot (name?: string) {
    this.sender.mock.shouldHaveLastRequestMatchSnapshot(name)
  }

  setResponse (event: string, hanlder: RequestHandler): void
  setResponse (event: string, data: RequestParams, retcode?: number): void
  setResponse (event: string, arg1: any, arg2?: any) {
    this.sender.mock.setResponse(event, arg1, arg2)
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
