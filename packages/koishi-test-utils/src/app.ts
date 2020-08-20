import { AppOptions, App, Server, Session, Bot } from 'koishi-core'
import { fn, Mock } from 'jest-mock'
import { expect } from 'chai'

type MethodsOf<O> = {
  [P in keyof O]: O[P] extends (...args: any[]) => any ? P : never
}[keyof O]

declare module 'koishi-core/dist/server' {
  interface Bot {
    mock<T extends MethodsOf<Bot>>(method: T): Bot[T] extends (...args: infer R) => T ? Mock<T, R> : never
  }
}

export const BASE_SELF_ID = 514

Bot.prototype.mock = function (this: Bot, method) {
  return this[method] = fn<any, any[]>(this[method]) as any
}

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

  receiveMessage(meta: Session): Promise<void>
  receiveMessage(type: 'user', message: string, userId: number): Promise<void>
  receiveMessage(type: 'group', message: string, userId: number, groupId: number): Promise<void>
  receiveMessage(type: 'user' | 'group' | Session, message?: string, userId?: number, ctxId: number = userId) {
    return new Promise((resolve) => {
      this.once('after-middleware', () => resolve())
      this.receive(typeof type === 'string' ? createMessageMeta(this, type, message, userId, ctxId) : type)
    })
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
    await this.app.receiveMessage(new Session(this.app, { ...this.meta, message, $send }))
  }

  async shouldHaveReply(message: string, reply?: string) {
    await this.send(message)
    const lastReply = this.replies[this.replies.length - 1]
    this.replies = []
    if (reply) {
      return expect(lastReply).to.equal(reply)
    } else {
      return expect(lastReply).to.be.ok
    }
  }

  async shouldHaveNoReply(message: string) {
    await this.send(message)
    return expect(this.replies).to.have.length(0)
  }

  shouldMatchSnapshot(message: string) {
    // TODO
    // return expect(this.send(message)).resolves.toMatchSnapshot(message)
  }
}

export { MockedApp as App }
