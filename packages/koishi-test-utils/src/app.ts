import { AppOptions, App, CQServer, Session as Meta, FileInfo } from 'koishi-core'
import { MockedServer, RequestParams, RequestData, RequestHandler } from './mocks'
import { Session, createMessageMeta } from './session'

export const BASE_SELF_ID = 514

declare module 'koishi-core/dist/server' {
  interface ServerTypes {
    mock: typeof MockedAppServer
  }
}

class MockedAppServer extends CQServer {
  mock = new MockedServer()

  constructor (app: App) {
    super(app)
  }

  _close () {}

  async _listen () {
    this.bots[0]._get = async (action, params) => {
      return this.mock.receive(action.replace(/_async$/, ''), params)
    }
  }
}

CQServer.types.mock = MockedAppServer

export class MockedApp extends App {
  server: MockedAppServer

  constructor (options: AppOptions = {}) {
    super({ selfId: BASE_SELF_ID, type: 'mock', ...options })
  }

  receive (meta: Partial<Meta>) {
    this.server['dispatch'](new Meta({
      selfId: this.bots[0].selfId,
      ...meta,
    }))
  }

  receiveFriendRequest (userId: number, flag = 'flag') {
    this.receive({ postType: 'request', requestType: 'friend', userId, flag })
  }

  receiveGroupRequest (subType: 'add' | 'invite', userId: number, groupId = 10000, flag = 'flag') {
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
  receiveMessage (type: 'user' | 'group' | Meta, message?: string, userId?: number, ctxId: number = userId) {
    return new Promise((resolve) => {
      this.once('after-middleware', () => resolve())
      this.receive(typeof type === 'string' ? createMessageMeta(type, message, userId, ctxId) : type)
    })
  }

  clearRequests () {
    this.server.mock.clearRequests()
  }

  shouldHaveNoRequests () {
    this.server.mock.shouldHaveNoRequests()
  }

  shouldHaveLastRequest (action: string, params: RequestParams = {}) {
    this.server.mock.shouldHaveLastRequest(action, params)
  }

  shouldHaveLastRequests (requests: RequestData[]) {
    this.server.mock.shouldHaveLastRequests(requests)
  }

  shouldMatchSnapshot (name = '') {
    this.server.mock.shouldMatchSnapshot(name)
  }

  setResponse (event: string, hanlder: RequestHandler): void
  setResponse (event: string, data: RequestParams, retcode?: number): void
  setResponse (event: string, arg1: any, arg2?: any) {
    this.server.mock.setResponse(event, arg1, arg2)
  }

  createSession (type: 'user', userId: number): Session
  createSession (type: 'group', userId: number, groupId: number): Session
  createSession (type: 'user' | 'group', userId: number, ctxId: number = userId) {
    return new Session(this, type, userId, ctxId)
  }
}

export { MockedApp as App }
