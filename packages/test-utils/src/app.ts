import { AppOptions, App, Sender, Server, ContextType, Meta, FileInfo } from 'koishi-core'
import { MockedServer, RequestParams, RequestData, RequestHandler } from './mocks'
import { Session, createMessageMeta } from './session'
import { BASE_SELF_ID } from './utils'
import debug from 'debug'

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
    this.receive({ postType: 'request', requestType: 'friend', userId, flag })
  }

  receiveGroupRequest (userId: number, subType: 'add' | 'invite', groupId = 10000, flag = 'flag') {
    this.receive({ postType: 'request', requestType: 'group', subType, userId, groupId, flag })
  }

  receiveGroupUpload (file: FileInfo, userId: number, groupId = 10000) {
    this.receive({ postType: 'notice', noticeType: 'group_upload', file, userId, groupId })
  }

  receiveGroupAdmin (subType: 'set' | 'unset', userId: number, groupId = 10000) {
    this.receive({ postType: 'notice', noticeType: 'group_admin', subType, userId, groupId })
  }

  receiveGroupIncrease (subType: 'approve' | 'invite', userId: number, groupId = 10000, operatorId = 1000) {
    this.receive({ postType: 'notice', noticeType: 'group_increase', subType, userId, groupId, operatorId })
  }

  receiveGroupDecrease (subType: 'leave' | 'kick' | 'kick_me', userId: number, groupId = 10000, operatorId = 1000) {
    this.receive({ postType: 'notice', noticeType: 'group_decrease', subType, userId, groupId, operatorId })
  }

  receiveGroupBan (subType: 'ban' | 'lift_ban', duration: number, userId: number, groupId = 10000, operatorId = 1000) {
    this.receive({ postType: 'notice', noticeType: 'group_ban', subType, userId, groupId, operatorId, duration })
  }

  receiveFriendAdd (userId: number) {
    this.receive({ postType: 'notice', noticeType: 'friend_add', userId })
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

  shouldMatchSnapshot (name = '') {
    this.sender.mock.shouldMatchSnapshot(name)
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

export { MockedApp as App }
