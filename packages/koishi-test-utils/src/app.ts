import { AppOptions, App, Server, Session } from 'koishi-core'
import { expect, AssertionError } from 'chai'

export const BASE_SELF_ID = 514

class MockedAppServer extends Server {
  constructor(app: App) {
    super(app)
    this.bots.forEach(bot => bot.ready = true)
  }

  _close() {}

  async _listen() {}
}

Server.types.mock = MockedAppServer

export class MockedApp extends App {
  server: MockedAppServer

  constructor(options: AppOptions = {}) {
    super({ selfId: BASE_SELF_ID, type: 'mock', ...options })
  }

  get selfId() {
    return this.bots[0].selfId
  }

  receive(meta: Partial<Session>) {
    this.server.dispatch(new Session(this, {
      selfId: this.bots[0].selfId,
      ...meta,
    }))
  }

  createSession(type: 'user', userId: number): TestSession
  createSession(type: 'group', userId: number, groupId: number): TestSession
  createSession(type: 'user' | 'group', userId: number, ctxId: number = userId) {
    return new TestSession(this, type, userId, ctxId)
  }
}

export const createMessageMeta = (app: App, type: 'user' | 'group', message: string, userId: number, ctxId: number) => new Session(app, {
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

export class TestSession {
  meta: Session
  replies: string[] = []

  constructor(public app: MockedApp, public type: 'user' | 'group', public userId: number, public ctxId: number) {
    this.meta = createMessageMeta(app, type, null, userId, ctxId)
  }

  async send(message: string) {
    const $send = async (message: string) => {
      if (message) this.replies.push(message)
    }
    return new Promise<string[]>((resolve) => {
      this.app.once('after-middleware', () => {
        resolve(this.replies)
        this.replies = []
      })
      this.app.receive({ ...this.meta, message, $send })
    })
  }

  shouldHaveReply(message: string, reply?: string) {
    const assertion = expect(this.send(message).then(replies => replies[replies.length - 1])).eventually
    if (reply) {
      return assertion.equal(reply)
    } else {
      return assertion.ok
    }
  }

  async shouldHaveNoReply(message: string) {
    const replies = await this.send(message)
    if (replies.length) {
      throw new AssertionError(`expected "${message}" to have no reply but got "${this.replies[0]}"`)
    }
  }
}

export { MockedApp as App }
